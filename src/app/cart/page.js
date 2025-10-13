'use client';

import { useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { CartContext, cartProductPrice } from '../components/AppContext';
import AddressInputs from '../components/layout/AddressInputs';
import SectionHeaders from '../components/layout/SectionHeaders';
import CartProduct from '../components/menu/CartProduct';

export default function CartPage() {
  const { cartProducts, removeCartProduct, clearCart } = useContext(CartContext);

  const [address, setAddress] = useState({
    phone: '',
    streetAddress: '',
    city: '',
    postalCode: '',
    country: '',
  });

  useEffect(() => {
  if (typeof window !== 'undefined') {
    const url = window.location.href;
    if (url.includes('canceled=1')) {
      toast.error('Payment failed 😔');
    }
    if (url.includes('clear-cart=1') || url.includes('success=1')) {
      clearCart();
      toast.success('Payment successful! Thank you for your order.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }
}, [clearCart]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('checkoutAddress');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAddress((prev) => ({ ...prev, ...parsed }));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('checkoutAddress', JSON.stringify(address));
  }, [address]);

  const subtotal =
    cartProducts?.reduce((sum, p) => sum + cartProductPrice(p), 0) || 0;
  const DELIVERY_FEE = 5;

  function handleAddressChange(propName, value) {
    setAddress((prev) => ({ ...prev, [propName]: value }));
  }

  async function proceedToCheckout(ev) {
    ev.preventDefault();

    // Validation
    if (!address.phone || address.phone.trim() === '') {
      toast.error('Phone number is required');
      return;
    }
    if (!address.streetAddress || address.streetAddress.trim() === '') {
      toast.error('Street address is required');
      return;
    }
    if (!address.city || address.city.trim() === '') {
      toast.error('City is required');
      return;
    }
    if (!address.postalCode || address.postalCode.trim() === '') {
      toast.error('Postal code is required');
      return;
    }
    if (!address.country || address.country.trim() === '') {
      toast.error('Country is required');
      return;
    }

    const promise = new Promise((resolve, reject) => {
      fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, cartProducts }),
      })
        .then(async (response) => {
          if (response.ok) {
            const url = await response.json();
            resolve();
            window.location = url;
          } else {
            reject();
          }
        })
        .catch(reject);
    });

    await toast.promise(promise, {
      loading: 'Preparing your order...',
      success: 'Redirecting to payment...',
      error: 'Something went wrong... Please try again later',
    });
  }

  if (!cartProducts?.length) {
    return (
      <section className="mt-8 text-center">
        <SectionHeaders mainHeader="Cart" />
        <p className="mt-4">Your shopping cart is empty 😔</p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="text-center">
        <SectionHeaders mainHeader="Cart" />
      </div>

      <div className="mt-8 grid gap-8 grid-cols-2">
        <div>
          {cartProducts.map((product, index) => (
            <CartProduct
              key={index}
              product={product}
              onRemove={() => removeCartProduct(index)}
            />
          ))}

          <div className="py-2 pr-16 flex justify-end items-center">
            <div className="text-gray-500">
              Subtotal:<br />
              Delivery:<br />
              Total:
            </div>
            <div className="font-semibold pl-2 text-right">
              ₱{subtotal}<br />
              ₱{DELIVERY_FEE}<br />
              ₱{subtotal + DELIVERY_FEE}
            </div>
          </div>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg" >
          <h2 style={{fontWeight:600, textTransform:'uppercase', marginBottom:'20px',textAlign:'center'}}>Checkout</h2>
          <form onSubmit={proceedToCheckout}>
            <AddressInputs
              addressProps={address}
              setAddressProp={handleAddressChange}
            />
            <button className='cursor-pointer' type="submit">Pay ₱{subtotal + DELIVERY_FEE}</button>
          </form>
        </div>
      </div>
    </section>
  );
}