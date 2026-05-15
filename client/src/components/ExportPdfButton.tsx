import React, { useState } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';

interface ExportPdfButtonProps {
  date: string; // формат 'YYYY-MM-DD'
  label?: string;
}

export const ExportPdfButton: React.FC<ExportPdfButtonProps> = ({ date, label }) => {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleExport = async () => {
    if (!date) {
      showToast('Оберіть дату для експорту', 'warning');
      return;
    }

    setLoading(true);
    try {
      // Запит повертає бінарний PDF
      const response = await axios.post(
        '/api/schedule/export-pdf',
        { date },
        { responseType: 'blob' }
      );

      // Формуємо назву файлу
      const dateLabel = new Date(date).toLocaleDateString('uk-UA', {
        day: '2-digit', month: '2-digit', year: 'numeric'
      }).replace(/\./g, '_');

      // Створюємо посилання для завантаження
      const url      = window.URL.createObjectURL(new Blob([response.data]));
      const link     = document.createElement('a');
      link.href      = url;
      link.download  = `Nakaz_${dateLabel}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      showToast('Наказ успішно завантажено', 'success');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Помилка генерації PDF';
      showToast(msg, 'danger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className={`cal-btn cal-btn-pdf${loading ? ' loading' : ''}`}
      onClick={handleExport}
      disabled={loading || !date}
      title={date ? `Завантажити наказ на ${date}` : 'Оберіть дату'}
    >
      {loading ? (
        <>
          <span className="auth-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
          Генерація...
        </>
      ) : (
        <>📄 {label || 'Наказ PDF'}</>
      )}
    </button>
  );
};