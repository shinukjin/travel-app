import { useCallback, useState } from 'react';

export function useMapExpand(navigation) {
  const [mode, setMode] = useState('half');

  const setMapMode = useCallback(
    (next) => {
      setMode(next);
    },
    []
  );

  const toggleList = useCallback(() => {
    if (mode === 'peek') setMapMode('half');
    else if (mode === 'half') setMapMode('peek');
    else setMapMode('half');
  }, [mode, setMapMode]);

  const toggleFull = useCallback(() => {
    setMapMode(mode === 'full' ? 'half' : 'full');
  }, [mode, setMapMode]);

  const onSnapMode = useCallback(
    (next) => {
      setMapMode(next);
    },
    [setMapMode]
  );

  return { mode, setMapMode, toggleList, toggleFull, onSnapMode };
}
