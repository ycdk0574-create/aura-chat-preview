-- Add DELETE policy for personalities table
CREATE POLICY "Users can delete their own personality settings"
ON public.personalities
FOR DELETE
USING (auth.uid() = user_id);