-- ========== Enums ==========
CREATE TYPE public.app_role AS ENUM ('admin', 'student');
CREATE TYPE public.order_status AS ENUM ('pending','accepted','preparing','ready','out_for_delivery','delivered','cancelled','rejected');
CREATE TYPE public.payment_status AS ENUM ('pending','paid','failed','refunded');

-- ========== Shared helpers ==========
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ========== Roles ==========
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin')
$$;
GRANT EXECUTE ON FUNCTION public.admin_exists() TO anon, authenticated;

-- ========== Students & Admins ==========
CREATE TABLE public.students (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  name_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.students TO authenticated;
GRANT ALL ON public.students TO service_role;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own profile, admins read all" ON public.students FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.admins (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  name_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admins TO authenticated;
GRANT ALL ON public.admins TO service_role;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read admins" ON public.admins FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- New auth users: students via student domain; first admin only via admin domain.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text := btrim(coalesce(NEW.raw_user_meta_data->>'name', ''));
  v_key text := split_part(NEW.email, '@', 1);
BEGIN
  IF char_length(v_name) < 2 OR char_length(v_name) > 50 THEN
    RAISE EXCEPTION 'Name must be 2 to 50 characters';
  END IF;
  IF NEW.email LIKE '%@students.campusbite.app' THEN
    INSERT INTO public.students (id, name, name_key) VALUES (NEW.id, v_name, v_key);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  ELSIF NEW.email LIKE '%@admins.campusbite.app' THEN
    PERFORM pg_advisory_xact_lock(hashtext('campusbite_first_admin'));
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
      RAISE EXCEPTION 'Admin registration is closed';
    END IF;
    INSERT INTO public.admins (id, name, name_key) VALUES (NEW.id, v_name, v_key);
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    RAISE EXCEPTION 'Unsupported account type';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== Categories ==========
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 1 AND 40),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update categories" ON public.categories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete categories" ON public.categories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ========== Food items ==========
CREATE TABLE public.food_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 300),
  price numeric(10,2) NOT NULL CHECK (price >= 0 AND price <= 100000),
  stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0 AND stock <= 100000),
  is_available boolean NOT NULL DEFAULT true,
  image_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.food_items TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.food_items TO authenticated;
GRANT ALL ON public.food_items TO service_role;
ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads food" ON public.food_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert food" ON public.food_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update food" ON public.food_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete food" ON public.food_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER food_items_updated_at BEFORE UPDATE ON public.food_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== Orders ==========
CREATE SEQUENCE public.order_code_seq START 1001;
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code text NOT NULL UNIQUE DEFAULT ('CB' || lpad(nextval('public.order_code_seq')::text, 6, '0')),
  student_id uuid NOT NULL,
  student_name text NOT NULL,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  pickup_date date NOT NULL,
  pickup_time text NOT NULL,
  status public.order_status NOT NULL DEFAULT 'pending',
  payment_status public.payment_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_student_idx ON public.orders (student_id, created_at DESC);
CREATE INDEX orders_status_idx ON public.orders (status);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own orders, admins read all" ON public.orders FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  food_item_id uuid REFERENCES public.food_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total numeric(10,2) NOT NULL
);
CREATE INDEX order_items_order_idx ON public.order_items (order_id);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read items of visible orders" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- ========== Payments ==========
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('razorpay','counter')),
  provider_order_id text,
  provider_payment_id text,
  amount numeric(10,2) NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_order_idx ON public.payments (order_id);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read payments of visible orders" ON public.payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========== Notifications ==========
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('new_order','order_cancelled')),
  title text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_created_idx ON public.notifications (created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read notifications" ON public.notifications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update notifications" ON public.notifications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ========== Order locations ==========
CREATE TABLE public.order_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  location_label text,
  latitude double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m double precision,
  source text NOT NULL CHECK (source IN ('manual','gps')),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_locations_order_idx ON public.order_locations (order_id, created_at DESC);
GRANT SELECT ON public.order_locations TO authenticated;
GRANT ALL ON public.order_locations TO service_role;
ALTER TABLE public.order_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read locations of visible orders" ON public.order_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));

-- ========== Stock history ==========
CREATE TABLE public.stock_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  food_item_id uuid NOT NULL REFERENCES public.food_items(id) ON DELETE CASCADE,
  change integer NOT NULL,
  new_stock integer NOT NULL,
  reason text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_history_item_idx ON public.stock_history (food_item_id, created_at DESC);
GRANT SELECT ON public.stock_history TO authenticated;
GRANT ALL ON public.stock_history TO service_role;
ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read stock history" ON public.stock_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.log_stock_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_reason text := nullif(current_setting('campusbite.stock_reason', true), '');
  v_order text := nullif(current_setting('campusbite.stock_order', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.stock_history (food_item_id, change, new_stock, reason, changed_by)
    VALUES (NEW.id, NEW.stock, NEW.stock, 'initial', auth.uid());
  ELSIF NEW.stock IS DISTINCT FROM OLD.stock THEN
    INSERT INTO public.stock_history (food_item_id, change, new_stock, reason, order_id, changed_by)
    VALUES (NEW.id, NEW.stock - OLD.stock, NEW.stock, coalesce(v_reason, 'admin_adjust'), v_order::uuid, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER food_items_stock_log AFTER INSERT OR UPDATE OF stock ON public.food_items
  FOR EACH ROW EXECUTE FUNCTION public.log_stock_change();
REVOKE EXECUTE ON FUNCTION public.log_stock_change() FROM PUBLIC, anon, authenticated;

-- ========== Pickup validation (IST) ==========
CREATE OR REPLACE FUNCTION public.validate_pickup(p_date date, p_time text)
RETURNS void LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  v_now timestamp := (now() AT TIME ZONE 'Asia/Kolkata');
  v_t time;
BEGIN
  IF p_time IS NULL OR p_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RAISE EXCEPTION 'Pickup time must be in 24-hour HH:mm format (e.g. 13:30)';
  END IF;
  v_t := p_time::time;
  IF v_t < time '08:00' OR v_t > time '18:00' THEN
    RAISE EXCEPTION 'Pickup time must be between 08:00 and 18:00 IST';
  END IF;
  IF p_date IS NULL OR p_date < v_now::date THEN
    RAISE EXCEPTION 'Pickup date cannot be in the past';
  END IF;
  IF p_date > v_now::date + 1 THEN
    RAISE EXCEPTION 'Pickup can be scheduled for today or tomorrow only';
  END IF;
  IF p_date = v_now::date AND (p_date + v_t) < v_now + interval '15 minutes' THEN
    RAISE EXCEPTION 'For today, pickup time must be at least 15 minutes from now (IST)';
  END IF;
END;
$$;

-- Restores stock for every item in an order (internal only).
CREATE OR REPLACE FUNCTION public.restore_order_stock(p_order_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  PERFORM set_config('campusbite.stock_reason', p_reason, true);
  PERFORM set_config('campusbite.stock_order', p_order_id::text, true);
  FOR r IN SELECT food_item_id, sum(quantity) AS qty FROM public.order_items
           WHERE order_id = p_order_id AND food_item_id IS NOT NULL
           GROUP BY food_item_id ORDER BY food_item_id LOOP
    UPDATE public.food_items SET stock = stock + r.qty WHERE id = r.food_item_id;
  END LOOP;
  PERFORM set_config('campusbite.stock_reason', '', true);
  PERFORM set_config('campusbite.stock_order', '', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.restore_order_stock(uuid, text) FROM PUBLIC, anon, authenticated;

-- ========== Place order (atomic, no overselling) ==========
CREATE OR REPLACE FUNCTION public.place_order(p_items jsonb, p_pickup_date date, p_pickup_time text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_order_id uuid;
  v_code text;
  v_total numeric(10,2) := 0;
  v_lines jsonb := '[]'::jsonb;
  v_item record;
  v_food public.food_items%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.has_role(v_uid, 'student') THEN
    RAISE EXCEPTION 'Only signed-in students can place orders';
  END IF;
  SELECT name INTO v_name FROM public.students WHERE id = v_uid;
  PERFORM public.validate_pickup(p_pickup_date, p_pickup_time);
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Your cart is empty';
  END IF;
  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Too many items in one order';
  END IF;

  INSERT INTO public.orders (student_id, student_name, pickup_date, pickup_time)
  VALUES (v_uid, v_name, p_pickup_date, p_pickup_time)
  RETURNING id, order_code INTO v_order_id, v_code;

  PERFORM set_config('campusbite.stock_reason', 'order', true);
  PERFORM set_config('campusbite.stock_order', v_order_id::text, true);

  FOR v_item IN
    SELECT (e->>'food_item_id')::uuid AS fid, sum((e->>'quantity')::int) AS qty
    FROM jsonb_array_elements(p_items) e GROUP BY 1 ORDER BY 1
  LOOP
    IF v_item.qty IS NULL OR v_item.qty < 1 OR v_item.qty > 50 THEN
      RAISE EXCEPTION 'Each item quantity must be between 1 and 50';
    END IF;
    SELECT * INTO v_food FROM public.food_items WHERE id = v_item.fid FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'An item in your cart is no longer on the menu';
    END IF;
    IF NOT v_food.is_available THEN
      RAISE EXCEPTION '% is currently unavailable', v_food.name;
    END IF;
    IF v_food.stock < v_item.qty THEN
      RAISE EXCEPTION 'Only % left in stock for %', v_food.stock, v_food.name;
    END IF;
    UPDATE public.food_items SET stock = stock - v_item.qty WHERE id = v_food.id;
    INSERT INTO public.order_items (order_id, food_item_id, item_name, unit_price, quantity, line_total)
    VALUES (v_order_id, v_food.id, v_food.name, v_food.price, v_item.qty, v_food.price * v_item.qty);
    v_total := v_total + v_food.price * v_item.qty;
    v_lines := v_lines || jsonb_build_object('name', v_food.name, 'quantity', v_item.qty, 'line_total', v_food.price * v_item.qty);
  END LOOP;

  PERFORM set_config('campusbite.stock_reason', '', true);
  PERFORM set_config('campusbite.stock_order', '', true);

  UPDATE public.orders SET total_amount = v_total WHERE id = v_order_id;

  INSERT INTO public.notifications (order_id, type, title, payload)
  VALUES (v_order_id, 'new_order', 'New order ' || v_code,
    jsonb_build_object('order_code', v_code, 'student_name', v_name, 'items', v_lines,
      'total', v_total, 'pickup_date', p_pickup_date, 'pickup_time', p_pickup_time));

  RETURN v_order_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.place_order(jsonb, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(jsonb, date, text) TO authenticated;

-- ========== Student cancels ==========
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_lines jsonb;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.student_id <> auth.uid() THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.status NOT IN ('pending','accepted') THEN
    RAISE EXCEPTION 'This order can no longer be cancelled because preparation has started';
  END IF;
  PERFORM public.restore_order_stock(p_order_id, 'cancel');
  UPDATE public.orders SET status = 'cancelled' WHERE id = p_order_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('name', item_name, 'quantity', quantity, 'line_total', line_total)), '[]'::jsonb)
    INTO v_lines FROM public.order_items WHERE order_id = p_order_id;
  INSERT INTO public.notifications (order_id, type, title, payload)
  VALUES (p_order_id, 'order_cancelled', 'Order ' || v_order.order_code || ' cancelled by student',
    jsonb_build_object('order_code', v_order.order_code, 'student_name', v_order.student_name, 'items', v_lines,
      'total', v_order.total_amount, 'pickup_date', v_order.pickup_date, 'pickup_time', v_order.pickup_time));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cancel_order(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_order(uuid) TO authenticated;

-- ========== Admin: order status ==========
CREATE OR REPLACE FUNCTION public.admin_update_order_status(p_order_id uuid, p_status public.order_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status IN ('delivered','cancelled','rejected') THEN
    RAISE EXCEPTION 'This order is already closed';
  END IF;
  IF v_order.status = p_status THEN RETURN; END IF;
  IF p_status IN ('cancelled','rejected') THEN
    PERFORM public.restore_order_stock(p_order_id, p_status::text);
  END IF;
  UPDATE public.orders SET status = p_status WHERE id = p_order_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_update_order_status(uuid, public.order_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_order_status(uuid, public.order_status) TO authenticated;

-- ========== Admin: counter payment / refund ==========
CREATE OR REPLACE FUNCTION public.admin_set_payment_status(p_order_id uuid, p_status public.payment_status, p_note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_order public.orders%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF p_status = 'refunded' AND v_order.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Only paid orders can be marked refunded';
  END IF;
  IF p_status = 'paid' AND v_order.payment_status = 'paid' THEN
    RAISE EXCEPTION 'Order is already paid';
  END IF;
  IF p_status = 'paid' THEN
    INSERT INTO public.payments (order_id, provider, amount, status, note)
    VALUES (p_order_id, 'counter', v_order.total_amount, 'paid', left(coalesce(p_note, 'Paid at counter'), 200));
  ELSE
    UPDATE public.payments SET status = p_status, note = left(coalesce(p_note, note), 200)
      WHERE order_id = p_order_id AND status = 'paid';
  END IF;
  UPDATE public.orders SET payment_status = p_status WHERE id = p_order_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_payment_status(uuid, public.payment_status, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_payment_status(uuid, public.payment_status, text) TO authenticated;

-- ========== Admin: location update ==========
CREATE OR REPLACE FUNCTION public.admin_update_location(
  p_order_id uuid, p_label text, p_latitude double precision, p_longitude double precision,
  p_accuracy double precision, p_source text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status public.order_status;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT status INTO v_status FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_status IN ('delivered','cancelled','rejected') THEN
    RAISE EXCEPTION 'Tracking has stopped for this order';
  END IF;
  IF p_source NOT IN ('manual','gps') THEN RAISE EXCEPTION 'Invalid location source'; END IF;
  IF p_source = 'gps' AND (p_latitude IS NULL OR p_longitude IS NULL) THEN
    RAISE EXCEPTION 'GPS updates need coordinates';
  END IF;
  IF nullif(btrim(coalesce(p_label, '')), '') IS NULL AND (p_latitude IS NULL OR p_longitude IS NULL) THEN
    RAISE EXCEPTION 'Enter a location description or coordinates';
  END IF;
  INSERT INTO public.order_locations (order_id, location_label, latitude, longitude, accuracy_m, source, updated_by)
  VALUES (p_order_id, left(nullif(btrim(p_label), ''), 120), p_latitude, p_longitude, p_accuracy, p_source, auth.uid());
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_update_location(uuid, text, double precision, double precision, double precision, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_location(uuid, text, double precision, double precision, double precision, text) TO authenticated;

-- ========== Admin: dashboard stats ==========
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date; v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT jsonb_build_object(
    'total', count(*),
    'new_today', count(*) FILTER (WHERE (created_at AT TIME ZONE 'Asia/Kolkata')::date = v_today),
    'pending', count(*) FILTER (WHERE status = 'pending'),
    'accepted', count(*) FILTER (WHERE status = 'accepted'),
    'preparing', count(*) FILTER (WHERE status = 'preparing'),
    'ready', count(*) FILTER (WHERE status = 'ready'),
    'out_for_delivery', count(*) FILTER (WHERE status = 'out_for_delivery'),
    'delivered', count(*) FILTER (WHERE status = 'delivered'),
    'cancelled', count(*) FILTER (WHERE status = 'cancelled'),
    'rejected', count(*) FILTER (WHERE status = 'rejected'),
    'paid', count(*) FILTER (WHERE payment_status = 'paid'),
    'unpaid', count(*) FILTER (WHERE payment_status IN ('pending','failed') AND status NOT IN ('cancelled','rejected')),
    'revenue', coalesce(sum(total_amount) FILTER (WHERE payment_status = 'paid'), 0)
  ) INTO v FROM public.orders;
  RETURN v;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

-- ========== Storage: food images ==========
CREATE POLICY "Admins upload food images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'food-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update food images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'food-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete food images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'food-images' AND public.has_role(auth.uid(), 'admin'));

-- ========== Realtime ==========
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.food_items;

-- ========== Seed menu ==========
INSERT INTO public.categories (name, sort_order) VALUES
  ('Breakfast', 1), ('Meals', 2), ('Snacks', 3), ('Beverages', 4), ('Desserts', 5);

INSERT INTO public.food_items (category_id, name, description, price, stock, image_path)
SELECT c.id, v.name, v.description, v.price, v.stock, v.image_path
FROM (VALUES
  ('Breakfast', 'Masala Dosa', 'Crispy rice crepe with spiced potato filling, sambar and coconut chutney.', 60, 30, 'seed/masala-dosa.jpg'),
  ('Breakfast', 'Idli Sambar', 'Three soft steamed idlis with hot sambar and chutney.', 40, 40, 'seed/idli-sambar.jpg'),
  ('Meals', 'Veg Thali', 'Rice, two rotis, dal, two sabzis, curd and pickle.', 90, 25, 'seed/veg-thali.jpg'),
  ('Meals', 'Veg Biryani', 'Fragrant basmati rice with mixed vegetables, served with raita.', 100, 20, 'seed/veg-biryani.jpg'),
  ('Meals', 'Paneer Butter Masala & Roti', 'Creamy tomato paneer curry with two butter rotis.', 120, 15, 'seed/paneer-butter-masala.jpg'),
  ('Snacks', 'Samosa (2 pcs)', 'Golden fried pastry with spiced potato and peas, mint chutney.', 25, 50, 'seed/samosa.jpg'),
  ('Snacks', 'Vada Pav', 'Mumbai-style potato fritter in a soft bun with chutneys.', 30, 35, 'seed/vada-pav.jpg'),
  ('Snacks', 'Veg Grilled Sandwich', 'Grilled sandwich with veggies, cheese and green chutney.', 45, 25, 'seed/veg-sandwich.jpg'),
  ('Beverages', 'Masala Chai', 'Hot ginger-cardamom tea.', 15, 100, 'seed/masala-chai.jpg'),
  ('Beverages', 'Cold Coffee', 'Chilled creamy coffee blended with ice.', 50, 30, 'seed/cold-coffee.jpg'),
  ('Beverages', 'Fresh Lime Soda', 'Sweet or salted fizzy lime cooler.', 35, 40, 'seed/lime-soda.jpg'),
  ('Desserts', 'Gulab Jamun (2 pcs)', 'Warm milk dumplings soaked in rose-cardamom syrup.', 40, 0, 'seed/gulab-jamun.jpg')
) AS v(category, name, description, price, stock, image_path)
JOIN public.categories c ON c.name = v.category;