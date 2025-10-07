import ChevronDown from "../../components/icons/ChevronDown";
import ChevronUp from "../../components/icons/ChevronUp";
import Plus from "../../components/icons/Plus";
import Trash from "../../components/icons/Trash";
import {useState} from "react";

export default function MenuItemPriceProps({name, addLabel, props, setProps}) {

  const [isOpen, setIsOpen] = useState(false);

  function addProp() {
    setProps(oldProps => {
      // Prevent duplicate additions
      return [...oldProps, {name: '', price: 0}];
    });
  }

  function editProp(ev, index, prop) {
    const newValue = ev.target.value;
    setProps(prevSizes => {
      const newSizes = [...prevSizes];
      newSizes[index][prop] = newValue;
      return newSizes;
    });
  }

  function removeProp(indexToRemove) {
    setProps(prev => prev.filter((v, index) => index !== indexToRemove));
  }

  return (
    <div style={{padding: '20px', marginBottom: '30px'}} className="bg-gray-200 rounded-md">
      <button
        style={{alignContent: 'center', display: 'flex', justifyContent: 'space-between', border: '2px solid #AB886D', width: '100%'}}
        onClick={() => setIsOpen(prev => !prev)}
        className="flex p-1 border-0 border-primary justify-start cursor-pointer"
        type="button">
        {isOpen ? <ChevronUp /> : <ChevronDown />}
        <span>{name}</span>
        <span>({props?.length || 0})</span>
      </button>
      <div className={isOpen ? 'block' : 'hidden'}>
        {props?.length > 0 && props.map((size, index) => (
          <div key={index} className="flex items-end gap-2">
            <div>
              <label>Name</label>
              <input 
                type="text"
                placeholder="Size name"
                value={size.name || ''}
                onChange={ev => editProp(ev, index, 'name')}
              />
            </div>
            <div>
              <label>Extra price</label>
              <input 
                type="text" 
                placeholder="Extra price"
                value={size.price || ''}
                onChange={ev => editProp(ev, index, 'price')}
              />
            </div>
            <div>
              <button 
                type="button"
                onClick={() => removeProp(index)}
                className="bg-white mb-2 px-2 cursor-pointer">
                <Trash />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addProp}
          style={{color: 'white', display: 'flex', alignContent: 'center', gap: 20, justifyContent: 'center', marginTop: '20px'}}
          className="bg-primary items-center cursor-pointer">
          <Plus style={{color: 'white'}} className="w-8 h-8" />
          <span>{addLabel}</span>
        </button>
      </div>
    </div>
  );
}