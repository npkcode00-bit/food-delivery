// app/components/layout/AddressInputs.jsx
'use client';

export default function AddressInputs({
  addressProps,
  setAddressProp,
  disableAddress, // optional: disables but still shows fields
  hideAddress,    // optional: completely hides address fields (preferred for pickup/dine-in)
}) {
  const {
    phone = '',
    streetAddress = '',
    city = '',
    country = '',
    // IMPORTANT: persist and use the same values end-to-end
    orderMethod = 'pickup', // 'pickup' | 'dine_in' | 'delivery'
  } = addressProps;

  const setOrderMethod = (val) => setAddressProp('orderMethod', val);

  // Determine if address should be hidden or disabled
  const shouldHideAddress =
    typeof hideAddress === 'boolean' ? hideAddress : false;

  const addressDisabled =
    typeof disableAddress === 'boolean'
      ? disableAddress
      : orderMethod !== 'delivery';

  return (
    <>
      <label className="block text-sm font-medium text-zinc-700 mb-1">
        Order method
      </label>
      <div className="w-full gap-2 mb-4 inline-flex rounded-xl border border-zinc-300 bg-white p-1">
        {[
          { k: 'pickup', label: 'Pick-up' },
          { k: 'dine_in', label: 'Dine-in' },
          { k: 'delivery', label: 'Delivery' },
        ].map(({ k, label }) => {
          const active = orderMethod === k;
          return (
            <span
              key={k}
              type="button"
              onClick={() => setOrderMethod(k)}
              aria-pressed={active}
              className={[
                'cursor-pointer w-full text-center rounded-lg px-4 py-2 text-sm font-semibold transition',
                active
                  ? 'bg-[#AB886D] text-white shadow'
                  : 'text-[#AB886D] border-2 shadow hover:bg-zinc-50',
              ].join(' ')}
            >
              {label}
            </span>
          );
        })}
      </div>

      <label className="block text-sm font-medium text-zinc-700">
        Phone *
      </label>
      <input
        type="text"
        placeholder="9xxxxxxxxx"
        inputMode="numeric"
        pattern="9[0-9]{9}"
        title="Phone must start with 9 and be 10 digits"
        maxLength={10}
        required
        className="mt-1 mb-3 w-full rounded-lg border px-3 py-2"
        value={phone}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 10);
          setAddressProp('phone', v);
        }}
      />

      {/* Only show address fields if not hidden (i.e., when delivery is selected) */}
      {!shouldHideAddress && (
        <>
          <label className="block text-sm font-medium text-zinc-700">
            Street address {orderMethod === 'delivery' && '*'}
          </label>
          <input
            disabled={addressDisabled}
            type="text"
            placeholder="Street address"
            required={orderMethod === 'delivery'}
            className="mt-1 mb-3 w-full rounded-lg border px-3 py-2 disabled:bg-zinc-100"
            value={streetAddress}
            onChange={(e) => setAddressProp('streetAddress', e.target.value)}
          />

          <div className="grid gap-2">
            <div>
              <label className="block w-full text-sm font-medium text-zinc-700">
                City {orderMethod === 'delivery' && '*'}
              </label>
              <input
                disabled={addressDisabled}
                type="text"
                placeholder="City"
                required={orderMethod === 'delivery'}
                className="mt-1 mb-3 w-full rounded-lg border px-3 py-2 disabled:bg-zinc-100"
                value={city}
                onChange={(e) => setAddressProp('city', e.target.value)}
              />
            </div>
          </div>

          <label className="block text-sm font-medium text-zinc-700">
            Country {orderMethod === 'delivery' && '*'}
          </label>
          <input
            disabled={addressDisabled}
            type="text"
            placeholder="Country"
            required={orderMethod === 'delivery'}
            className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-zinc-100"
            value={country}
            onChange={(e) => setAddressProp('country', e.target.value)}
          />
        </>
      )}
    </>
  );
}
