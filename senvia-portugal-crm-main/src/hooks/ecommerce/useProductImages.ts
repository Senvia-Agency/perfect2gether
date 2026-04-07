import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { ProductImage } from '@/types/ecommerce';

export function useProductImages(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-images', productId],
    queryFn: async () => {
      if (!productId) return [];

      const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productId)
        .order('position', { ascending: true });

      if (error) throw error;
      return data as ProductImage[];
    },
    enabled: !!productId,
  });
}

export function useUploadProductImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      file,
      isPrimary = false,
    }: {
      productId: string;
      file: File;
      isPrimary?: boolean;
    }) => {
      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      // Get current max position
      const { data: existingImages } = await supabase
        .from('product_images')
        .select('position')
        .eq('product_id', productId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = existingImages?.[0]?.position ?? -1;

      // If this is primary, unset other primaries
      if (isPrimary) {
        await supabase
          .from('product_images')
          .update({ is_primary: false })
          .eq('product_id', productId);
      }

      // Create image record
      const { data, error } = await supabase
        .from('product_images')
        .insert({
          product_id: productId,
          url: urlData.publicUrl,
          is_primary: isPrimary,
          position: nextPosition + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-images', variables.productId] });
      toast.success('Imagem adicionada');
    },
    onError: (error: Error) => {
      console.error('Error uploading image:', error);
      toast.error('Erro ao carregar imagem');
    },
  });
}

export function useSetPrimaryImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ imageId, productId }: { imageId: string; productId: string }) => {
      // Unset all primaries
      await supabase
        .from('product_images')
        .update({ is_primary: false })
        .eq('product_id', productId);

      // Set new primary
      const { data, error } = await supabase
        .from('product_images')
        .update({ is_primary: true })
        .eq('id', imageId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-images', variables.productId] });
      toast.success('Imagem principal definida');
    },
    onError: (error: Error) => {
      console.error('Error setting primary image:', error);
      toast.error('Erro ao definir imagem principal');
    },
  });
}

export function useUpdateImagePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      imageId,
      productId,
      position,
    }: {
      imageId: string;
      productId: string;
      position: number;
    }) => {
      const { data, error } = await supabase
        .from('product_images')
        .update({ position })
        .eq('id', imageId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-images', variables.productId] });
    },
    onError: (error: Error) => {
      console.error('Error updating image position:', error);
    },
  });
}

export function useDeleteProductImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ imageId, productId, url }: { imageId: string; productId: string; url: string }) => {
      // Extract path from URL
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/product-images\/(.+)$/);
      
      if (pathMatch) {
        // Delete from storage
        await supabase.storage
          .from('product-images')
          .remove([pathMatch[1]]);
      }

      // Delete record
      const { error } = await supabase
        .from('product_images')
        .delete()
        .eq('id', imageId);

      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      queryClient.invalidateQueries({ queryKey: ['product-images', productId] });
      toast.success('Imagem eliminada');
    },
    onError: (error: Error) => {
      console.error('Error deleting image:', error);
      toast.error('Erro ao eliminar imagem');
    },
  });
}
