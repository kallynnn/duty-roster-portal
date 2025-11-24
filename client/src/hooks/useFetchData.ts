import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; // 1. Імпортуємо хук автентифікації

export const useFetchData = <T,>(url: string) => {
  const { token } = useAuth(); // 2. Отримуємо токен з Контексту
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 'axios' вже має 'Authorization' заголовок,
      // тому що 'AuthContext' його встановив глобально.
      // Нам просто треба дочекатися, поки 'token' стане доступним.
      const response = await axios.get(url);
      setData(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 3. ПРАВИЛЬНА ЛОГІКА:
    // Запускаємо 'fetchData' ТІЛЬКИ ТОДІ, коли 'token' вже завантажено
    // (тобто, ми точно знаємо, що ми або залогінені, або ні)
    if (token) {
      fetchData();
    }
  }, [url, token]); // 4. 'token' тепер є залежністю

  return { data, isLoading, error, refetch: fetchData };
};