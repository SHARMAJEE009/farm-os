'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';

interface FarmContextType {
  activeFarmId: string | null;
  setActiveFarmId: (id: string) => void;
}

const FarmContext = createContext<FarmContextType>({
  activeFarmId: null,
  setActiveFarmId: () => {},
});

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const [activeFarmId, setActiveFarmIdState] = useState<string | null>(null);

  useEffect(() => {
    const saved = Cookies.get('farm_id');
    if (saved) setActiveFarmIdState(saved);
  }, []);

  const setActiveFarmId = (id: string) => {
    Cookies.set('farm_id', id, { expires: 30 });
    setActiveFarmIdState(id);
  };

  return (
    <FarmContext.Provider value={{ activeFarmId, setActiveFarmId }}>
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm() {
  return useContext(FarmContext);
}
