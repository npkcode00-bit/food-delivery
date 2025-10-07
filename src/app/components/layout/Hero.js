import Right from "../icons/Right";

export default function Hero() {
  return (
    <section className="hero mt-4">
      <div className="py-4">
        <h1 className="text-4xl font-semibold">
          Everything <br />
          is better <br />
          with a&nbsp;
          <span style={{color:'#493628'}}>PINAGPALA</span>
        </h1>

        

        <div className="flex gap-4 text-sm" style={{color:'white', marginTop:'20px'}}>
          <button
            type="button"
            className="flex items-center gap-2 px-8 py-2 rounded-full bg-primary text-white uppercase cursor-pointer"
           
          >
            <a href="/menu" className="flex items-center gap-2"  style={{display:'flex',color:'white'}}>
              Order now
            <Right />
            </a>
          </button>
          <button
            type="button"
            
          >
            <a href="#about" className="cursor-pointer flex items-center gap-2 py-2 font-semibold text-gray-600" style={{display:'flex',color:'black'}}>
            Learn more
            <Right />
            </a>
          </button>
        </div>
      </div>

      
    </section>
  );
}
