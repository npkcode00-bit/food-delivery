export default function AddressInputs({addressProps,setAddressProp,disabled=false}) {
  const {phone, streetAddress, postalCode, city, country} = addressProps;
  return (
    <>
      <label>Phone</label>
    <input
      type="text"
      placeholder="9xxxxxxxxx"
      inputMode="numeric"
      pattern="9[0-9]{9}"                 // starts with 9, then 9 digits = 10 total
      title="Phone must start with 9 and be 10 digits"
      maxLength={10}
      value={phone ?? ''}
      onChange={(e) => {
        const v = e.target.value.replace(/\D/g, '').slice(0, 10); // digits only, cap to 10
        setAddressProp('phone', v);
      }}
    />



      <label>Street address</label>
      <input
        disabled={disabled}
        type="text" placeholder="Street address"
        value={streetAddress || ''} onChange={ev => setAddressProp('streetAddress', ev.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label>Postal code</label>
          <input
            disabled={disabled}
            type="text" placeholder="Postal code"
            value={postalCode || ''} onChange={ev => setAddressProp('postalCode', ev.target.value)}
          />
        </div>
        <div>
          <label>City</label>
          <input
            disabled={disabled}
            type="text" placeholder="City"
            value={city || ''} onChange={ev => setAddressProp('city', ev.target.value)}
          />
        </div>
      </div>
      <label>Country</label>
      <input
        disabled={disabled}
        type="text" placeholder="Country"
        value={country || ''} onChange={ev => setAddressProp('country', ev.target.value)}
      />
    </>
  );
}