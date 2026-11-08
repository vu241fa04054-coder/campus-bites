CREATE POLICY "Signed-in users read food images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'food-images');