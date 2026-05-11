import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { UsedGearListing } from '@/app/(tabs)/marketplace';

type GearWishlistContextType = {
  gearWishlistIds: Set<string>;
  gearWishlistItems: GearWishlistItem[];
  loading: boolean;
  isGearWishlisted: (listingId: string) => boolean;
  toggleGear: (listing: UsedGearListing) => Promise<{ added: boolean }>;
  removeGear: (listingId: string) => Promise<void>;
  count: number;
};

export type GearWishlistItem = {
  id: string;
  listing: UsedGearListing;
  created_at: string;
};

const GearWishlistContext = createContext<GearWishlistContextType | undefined>(undefined);

export function GearWishlistProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [gearWishlistIds, setGearWishlistIds] = useState<Set<string>>(new Set());
  const [gearWishlistItems, setGearWishlistItems] = useState<GearWishlistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const pendingRef = useRef<Set<string>>(new Set());

  const loadGearWishlist = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const queryPromise = supabase
        .from('gear_wishlist')
        .select(`
          id,
          created_at,
          listing:used_gear_listings(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 10000)
      );

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

      if (!error && data) {
        const items: GearWishlistItem[] = (data as any[])
          .filter((row) => row.listing)
          .map((row) => ({
            id: row.id,
            created_at: row.created_at,
            listing: row.listing as UsedGearListing,
          }));
        setGearWishlistItems(items);
        setGearWishlistIds(new Set(items.map((i) => i.listing.id)));
      }
    } catch {
      // Network error or timeout — keep existing state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadGearWishlist(user.id);
    } else {
      setGearWishlistIds(new Set());
      setGearWishlistItems([]);
    }
  }, [isAuthenticated, user?.id]);

  const isGearWishlisted = useCallback(
    (listingId: string) => gearWishlistIds.has(listingId),
    [gearWishlistIds]
  );

  const toggleGear = useCallback(
    async (listing: UsedGearListing): Promise<{ added: boolean }> => {
      if (!user) return { added: false };
      if (pendingRef.current.has(listing.id)) return { added: gearWishlistIds.has(listing.id) };

      pendingRef.current.add(listing.id);
      const alreadyAdded = gearWishlistIds.has(listing.id);

      if (alreadyAdded) {
        setGearWishlistIds((prev) => {
          const next = new Set(prev);
          next.delete(listing.id);
          return next;
        });
        setGearWishlistItems((prev) => prev.filter((i) => i.listing.id !== listing.id));
      } else {
        setGearWishlistIds((prev) => new Set([...prev, listing.id]));
        setGearWishlistItems((prev) => [
          { id: `optimistic-${listing.id}`, listing, created_at: new Date().toISOString() },
          ...prev,
        ]);
      }

      try {
        let serverError: any = null;
        if (alreadyAdded) {
          const { error } = await supabase
            .from('gear_wishlist')
            .delete()
            .eq('user_id', user.id)
            .eq('listing_id', listing.id);
          serverError = error;
        } else {
          const { error } = await supabase
            .from('gear_wishlist')
            .insert({ user_id: user.id, listing_id: listing.id });
          serverError = error;
        }

        if (serverError) {
          // Rollback on server error
          if (alreadyAdded) {
            setGearWishlistIds((prev) => new Set([...prev, listing.id]));
            setGearWishlistItems((prev) => [
              { id: `rollback-${listing.id}`, listing, created_at: new Date().toISOString() },
              ...prev.filter((i) => i.listing.id !== listing.id),
            ]);
          } else {
            setGearWishlistIds((prev) => {
              const next = new Set(prev);
              next.delete(listing.id);
              return next;
            });
            setGearWishlistItems((prev) => prev.filter((i) => i.listing.id !== listing.id));
          }
          return { added: alreadyAdded };
        }

        await loadGearWishlist(user.id);
      } catch {
        // Network failure — rollback
        if (alreadyAdded) {
          setGearWishlistIds((prev) => new Set([...prev, listing.id]));
          setGearWishlistItems((prev) => [
            { id: `rollback-${listing.id}`, listing, created_at: new Date().toISOString() },
            ...prev.filter((i) => i.listing.id !== listing.id),
          ]);
        } else {
          setGearWishlistIds((prev) => {
            const next = new Set(prev);
            next.delete(listing.id);
            return next;
          });
          setGearWishlistItems((prev) => prev.filter((i) => i.listing.id !== listing.id));
        }
        return { added: alreadyAdded };
      } finally {
        pendingRef.current.delete(listing.id);
      }

      return { added: !alreadyAdded };
    },
    [user, gearWishlistIds, loadGearWishlist]
  );

  const removeGear = useCallback(
    async (listingId: string) => {
      if (!user) return;
      setGearWishlistIds((prev) => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
      setGearWishlistItems((prev) => prev.filter((i) => i.listing.id !== listingId));
      await supabase
        .from('gear_wishlist')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listingId);
    },
    [user]
  );

  return (
    <GearWishlistContext.Provider
      value={{
        gearWishlistIds,
        gearWishlistItems,
        loading,
        isGearWishlisted,
        toggleGear,
        removeGear,
        count: gearWishlistIds.size,
      }}
    >
      {children}
    </GearWishlistContext.Provider>
  );
}

const FALLBACK: GearWishlistContextType = {
  gearWishlistIds: new Set(),
  gearWishlistItems: [],
  loading: false,
  isGearWishlisted: () => false,
  toggleGear: async () => ({ added: false }),
  removeGear: async () => {},
  count: 0,
};

export function useGearWishlist() {
  return useContext(GearWishlistContext) ?? FALLBACK;
}
