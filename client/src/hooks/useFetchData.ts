import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface UseFetchDataOptions {
  // Якщо true — завантажуємо навіть без токена (для гостей)
  allowGuest?: boolean;
}

export const useFetchData = <T,>(url: string, options: UseFetchDataOptions = {}) => {
  const { token } = useAuth();
  const { allowGuest = false } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get(url);
      setData(response.data);
    } catch (err: any) {
      setError(err.message || 'Помилка завантаження даних');
    } finally {
      setIsLoading(false);
    }
  }, [url]);

  useEffect(() => {
    // 🔴 ВИПРАВЛЕНО:
    // - Якщо є токен — завантажуємо (залогінений користувач)
    // - Якщо allowGuest = true — завантажуємо і без токена (гість)
    // - Інакше — чекаємо на токен
    if (token || allowGuest) {
      fetchData();
    }
  }, [url, token, allowGuest, fetchData]);

  return { data, isLoading, error, refetch: fetchData };
};