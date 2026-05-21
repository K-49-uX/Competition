import { Link } from 'react-router-dom';
import { Compass, Home as HomeIcon, MapPin, BookOpen, CalendarCheck } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function NotFound() {
  useDocumentTitle('Page not found');

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="mx-auto inline-grid place-items-center w-20 h-20 rounded-full bg-primary/10 text-primary mb-5">
        <Compass size={40} strokeWidth={2} />
      </div>
      <h1 className="text-4xl md:text-5xl font-extrabold text-neutral-900 dark:text-white">
        404
      </h1>
      <p className="mt-2 text-lg text-neutral-700 dark:text-slate-300">
        We couldn&apos;t find that page.
      </p>
      <p className="text-sm text-neutral-600 dark:text-slate-400 mt-1">
        Check the address, or jump to one of these pages:
      </p>
      <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
        <Link to="/" className="card text-center !p-4 hover:no-underline">
          <HomeIcon className="mx-auto text-primary dark:text-accent mb-2" size={22} />
          <div className="font-semibold text-sm text-neutral-900 dark:text-white">Home</div>
        </Link>
        <Link to="/clinics" className="card text-center !p-4 hover:no-underline">
          <MapPin className="mx-auto text-primary dark:text-accent mb-2" size={22} />
          <div className="font-semibold text-sm text-neutral-900 dark:text-white">Find a clinic</div>
        </Link>
        <Link to="/book" className="card text-center !p-4 hover:no-underline">
          <CalendarCheck className="mx-auto text-primary dark:text-accent mb-2" size={22} />
          <div className="font-semibold text-sm text-neutral-900 dark:text-white">Book</div>
        </Link>
        <Link to="/education" className="card text-center !p-4 hover:no-underline">
          <BookOpen className="mx-auto text-primary dark:text-accent mb-2" size={22} />
          <div className="font-semibold text-sm text-neutral-900 dark:text-white">Education</div>
        </Link>
      </div>
    </div>
  );
}
