import { AppProvider } from "../app/components/AppContext";
import Header from "../app/components/layout/Header";
import AdminOrderNotifications from "../app/components/AdminOrderNotifications";
import FloatingCart from "../app/components/layout/FloatingCart"; // ⬅️ add this
import { Roboto } from 'next/font/google';
import './globals.css';
import { Toaster } from "react-hot-toast";

const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'] });

export const metadata = {
  title: 'Pinagpala',
  description: 'Order delicious food online',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={roboto.className}>
        <main className="mx-auto p-4">
          <AppProvider>
            <Toaster />
            <AdminOrderNotifications />
            <Header />
            {children}
            <FloatingCart />  {/* ⬅️ floating button + mini-cart */}
          </AppProvider>
        </main>
      </body>
    </html>
  );
}
