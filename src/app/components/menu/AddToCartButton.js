import FlyingButton from '../CustomFlyingButton'

export default function AddToCartButton({
  hasSizesOrExtras, onClick, basePrice, image
}) {
  if (!hasSizesOrExtras) {
    return (
      <div className="flying-button-parent mt-4 cursor-pointer border-2" style={{borderRadius:'10px', maxWidth:'150px',justifySelf:'center',width:'100%'}}>
        <FlyingButton
          targetTop={'5%'}
          targetLeft={'95%'}
          src={image}>
          <div className='' onClick={onClick}>
            Add to cart ${basePrice}
          </div>
        </FlyingButton>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 bg-primary text-white rounded-full px-8 py-2 cursor-pointer border-2"
    >
      <span>Add to cart (from ${basePrice})</span>
    </button>
  );
}