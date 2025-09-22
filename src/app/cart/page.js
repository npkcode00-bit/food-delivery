'use client';

import { useContext, useEffect, useState } from "react";
import toast from "react-hot-toast";

import { CartContext, cartProductPrice } from "../components/AppContext";
import AddressInputs from "../components/layout/AddressInputs";
import SectionHeaders from "../components/layout/SectionHeaders";
import CartProduct from "../components/menu/CartProduct";

export default function CartPage() {
  const { cartProducts, removeCartProduct } = useContext(CartContext);

  const [address, setAddress] = useState({
    phone: "",
    streetAddress: "",
    city: "",
    postalCode: "",
    country: "",
  });

  // Show Stripe failure toast if redirected with ?canceled=1
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.href.includes("canceled=1")) {
      toast.error("Payment failed 😔");
    }
  }, []);

  // Load saved address (no /api/profile)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("checkoutAddress");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setAddress(prev => ({ ...prev, ...parsed }));
      } catch { /* ignore */ }
    }
  }, []);

  // Persist address as user types
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("checkoutAddress", JSON.stringify(address));
  }, [address]);

  const subtotal = cartProducts?.reduce((sum, p) => sum + cartProductPrice(p), 0) || 0;
  const DELIVERY_FEE = 5;

  function handleAddressChange(propName, value) {
    setAddress(prev => ({ ...prev, [propName]: value }));
  }

  async function proceedToCheckout(ev) {
    ev.preventDefault();

    const promise = new Promise((resolve, reject) => {
      fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, cartProducts }),
      })
        .then(async (response) => {
          if (response.ok) {
            resolve();
            const url = await response.json();
            window.location = url; // redirect to Stripe
          } else {
            reject();
          }
        })
        .catch(reject);
    });

    await toast.promise(promise, {
      loading: "Preparing your order...",
      success: "Redirecting to payment...",
      error: "Something went wrong... Please try again later",
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
              onRemove={removeCartProduct}
            />
          ))}

          <div className="py-2 pr-16 flex justify-end items-center">
            <div className="text-gray-500">
              Subtotal:<br />
              Delivery:<br />
              Total:
            </div>
            <div className="font-semibold pl-2 text-right">
              ${subtotal}<br />
              ${DELIVERY_FEE}<br />
              ${subtotal + DELIVERY_FEE}
            </div>
          </div>
        </div>

        <div className="bg-gray-100 p-4 rounded-lg">
          <h2>Checkout</h2>
          <form onSubmit={proceedToCheckout}>
            <AddressInputs
              addressProps={address}
              setAddressProp={handleAddressChange}
            />
            <button type="submit">Pay ${subtotal + DELIVERY_FEE}</button>
          </form>
        </div>
      </div>
    </section>
  );
}
