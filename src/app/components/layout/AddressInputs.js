// app/components/layout/AddressInputs.jsx
'use client';

// Barangays of San Mateo, Rizal
const BARANGAYS = [
  'Ampid 1',
  'Ampid 2',
  'Banaba',
  'Dulong Bayan 1',
  'Dulong Bayan 2',
  'Guinayang',
  'Guitnang Bayan 1',
  'Guitnang Bayan 2',
  'Gulod Malaya',
  'Malanday',
  'Maly',
  'Pintong Bukawe',
  'Santa Ana',
  'Santo Niño',
  'Silangan',
];

export default function AddressInputs({
  addressProps,
  setAddressProp,
  disableAddress, // optional: disables but still shows fields
  hideAddress,    // optional: completely hides address fields (preferred for pickup)
}) {
  const {
    phone = '',
    streetAddress = '',
    barangay = '',
    city = 'San Mateo',
    province = 'Rizal',
    country = 'Philippines',
    // canonical order method
    orderMethod = 'pickup', // 'pickup' | 'delivery'
  } = addressProps;

  const setOrderMethod = (val) => setAddressProp('orderMethod', val);

  const shouldHideAddress =
    typeof hideAddress === 'boolean' ? hideAddress : false;

  const addressDisabled =
    typeof disableAddress === 'boolean'
      ? disableAddress
      : orderMethod !== 'delivery';

  return (
    <>
      {/* Order Method toggle */}
      <label className="block text-sm font-medium text-zinc-700 mb-1">
        Order method
      </label>
      <div className="w-full gap-2 mb-4 inline-flex rounded-xl border border-zinc-300 bg-white p-1">
        {[
          { k: 'pickup', label: 'Pick-up' },
          { k: 'delivery', label: 'Delivery' },
        ].map(({ k, label }) => {
          const active = orderMethod === k;
          return (
            <span
              key={k}
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

      {/* Phone */}
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

      {/* Address fields – only show when not hidden (we still respect orderMethod for required/disabled) */}
      {!shouldHideAddress && (
        <>
          {/* Street */}
          <label className="block text-sm font-medium text-zinc-700">
            Street Address {orderMethod === 'delivery' && '*'}
          </label>
          <input
            disabled={addressDisabled}
            type="text"
            placeholder="e.g., 123 Main Street, Block 5 Lot 10"
            required={orderMethod === 'delivery'}
            className="mt-1 mb-3 w-full rounded-lg border px-3 py-2 disabled:bg-zinc-100"
            value={streetAddress}
            onChange={(e) => setAddressProp('streetAddress', e.target.value)}
          />

          {/* Barangay */}
          <label className="block text-sm font-medium text-zinc-700">
            Barangay {orderMethod === 'delivery' && '*'}
          </label>
          <select
            disabled={addressDisabled}
            required={orderMethod === 'delivery'}
            className="mt-1 mb-3 w-full rounded-lg border px-3 py-2 disabled:bg-zinc-100"
            value={barangay}
            onChange={(e) => setAddressProp('barangay', e.target.value)}
          >
            <option value="">Select barangay</option>
            {BARANGAYS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>

          {/* City + Province (locked like profile) */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                City
              </label>
              <input
                disabled
                readOnly
                type="text"
                className="mt-1 mb-3 w-full rounded-lg border px-3 py-2 bg-zinc-100 cursor-not-allowed"
                value={city}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Province
              </label>
              <input
                disabled
                readOnly
                type="text"
                className="mt-1 mb-3 w-full rounded-lg border px-3 py-2 bg-zinc-100 cursor-not-allowed"
                value={province}
              />
            </div>
          </div>

          {/* Country (read-only, just to show) */}
          <label className="block text-sm font-medium text-zinc-700">
            Country
          </label>
          <input
            disabled
            readOnly
            type="text"
            className="mt-1 w-full rounded-lg border px-3 py-2 bg-zinc-100 cursor-not-allowed"
            value={country}
          />
        </>
      )}
    </>
  );
}
