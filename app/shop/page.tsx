'use client';

import { useEffect, useState } from 'react';
import { Book } from '@/lib/types';
import { useCart } from '@/lib/cart-context';
import Image from 'next/image';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export default function ShopPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const res = await fetch('/api/books', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) setBooks(data);
      } catch (error) {
        console.error('Error fetching books:', error);
        setBooks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBooks();
  }, []);

  const handleAddToCart = (book: Book) => {
    if (!book.price) return;
    addItem({
      bookId: book.id,
      title: book.title,
      price: book.price,
      quantity: 1,
      image: book.cover_image,
    });
  };

  return (
    <main className="min-h-screen bg-cf-bg text-cf-text-1">
      <SiteHeader activePath="/shop" />

      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16">
        <div className="mb-12">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-cf-accent">издания canfly</p>
          <h1 className="text-4xl font-black uppercase leading-none text-cf-text-heading md:text-5xl">Магазин</h1>
          <p className="mt-4 text-lg text-cf-text-caption">Приобретите книги, комиксы и аудиокниги вселенной canfly</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-cf-text-3">Загрузка товаров...</div>
        ) : books.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book, i) => (
              <div key={book.id} className="border border-cf-text-1/10 bg-cf-bg-2 overflow-hidden hover:border-cf-warm/45 transition-colors group">
                {book.cover_image ? (
                  <div className="relative w-full h-72 overflow-hidden bg-cf-footer-bg">
                    <Image
                      src={book.cover_image}
                      alt={book.title}
                      fill
                      priority={i < 3}
                      sizes="(max-width:768px) 50vw, 25vw"
                      className="object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                ) : (
                  <div className="w-full h-72 bg-cf-bg flex items-center justify-center text-cf-text-4">
                    Нет обложки
                  </div>
                )}

                <div className="p-5">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-cf-blue">
                    {book.type === 'comic' && 'Комикс'}
                    {book.type === 'book' && 'Книга'}
                    {book.type === 'audiobook' && 'Аудиокнига'}
                  </p>

                  <h3 className="text-lg font-black uppercase leading-tight text-cf-text-heading mb-3 line-clamp-2">
                    {book.title}
                  </h3>

                  <p className="text-cf-text-caption text-sm mb-4 line-clamp-2">
                    {book.description}
                  </p>

                  <div className="flex items-end justify-between">
                    {book.price ? (
                      <div className="text-xl font-black text-cf-warm">
                        {(book.price / 100).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' })}
                      </div>
                    ) : (
                      <div className="text-cf-text-4 text-sm">Цена не указана</div>
                    )}

                    {book.price && (
                      <button
                        onClick={() => handleAddToCart(book)}
                        className="inline-flex h-10 items-center bg-cf-accent px-4 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-[#b01e1e]"
                      >
                        В корзину
                      </button>
                    )}
                  </div>

                  {book.external_links && Object.keys(book.external_links).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-cf-text-1/10 flex gap-3">
                      {Object.entries(book.external_links).map(([store, url]) => (
                        <a
                          key={store}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-cf-blue hover:text-cf-text-1 transition-colors"
                        >
                          {store}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-cf-text-3">
            Товары не найдены
          </div>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
