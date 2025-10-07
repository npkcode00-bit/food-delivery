import FlyingButton from '../CustomFlyingButton'

export default function AddToCartButton({
  hasSizesOrExtras, onClick, basePrice, image
}) {
  if (!hasSizesOrExtras) {
    return (
      <div>
        <FlyingButton
          targetTop={'5%'}
          targetLeft={'95%'}
          src={image}>
          <button
            type="button"
            onClick={onClick}
            style={{color:'white'}}
            className="mt-4 bg-primary text-white rounded-full px-8 py-2 cursor-pointer border-2"
          >
            <span>Add to Cart ₱{basePrice}</span>
          </button>
        </FlyingButton>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      style={{color:'white'}}
      className="mt-4 bg-primary text-white rounded-full px-8 py-2 cursor-pointer border-2"
    >
      <span>Add to Cart ₱{basePrice}</span>
    </button>
  );
}