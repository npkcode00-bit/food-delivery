import Plus from "../../components/icons/Plus";
import Trash from "../../components/icons/Trash";
import EditableImage from "../../components/layout/EditableImage";
import MenuItemPriceProps from "../../components/layout/MenuItemPriceProps";
import {useEffect, useState} from "react";
import toast from "react-hot-toast";

export default function MenuItemForm({onSubmit,menuItem}) {
  const [image, setImage] = useState(menuItem?.image || '');
  const [name, setName] = useState(menuItem?.name || '');
  const [description, setDescription] = useState(menuItem?.description || '');
  const [basePrice, setBasePrice] = useState(menuItem?.basePrice || '');
  const [sizes, setSizes] = useState(menuItem?.sizes || []);
  const [category, setCategory] = useState(menuItem?.category || '');
  const [categories, setCategories] = useState([]);
  const [
    extraIngredientPrices,
    setExtraIngredientPrices,
  ] = useState(menuItem?.extraIngredientPrices || []);

  useEffect(() => {
    fetch('/api/categories').then(res => {
      res.json().then(categories => {
        setCategories(categories);
        // Set first category as default if no category is selected
        if (!category && categories.length > 0) {
          setCategory(categories[0]._id);
        }
      });
    });
  }, []);

  // Update category when menuItem changes
  useEffect(() => {
    if (menuItem?.category) {
      setCategory(menuItem.category);
    }
  }, [menuItem]);

  const handleSubmit = (ev) => {
    ev.preventDefault();

    // Validation
    if (!name || name.trim() === '') {
      toast.error('Item name is required');
      return;
    }

    if (!basePrice || basePrice === '' || isNaN(basePrice) || parseFloat(basePrice) < 0) {
      toast.error('Please enter a valid base price');
      return;
    }

    if (!category) {
      toast.error('Please select a category');
      return;
    }

    // Call the parent's onSubmit with validated data
    onSubmit(ev, {
      image,
      name: name.trim(),
      description: description.trim(),
      basePrice,
      sizes,
      extraIngredientPrices,
      category,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 max-w-2xl mx-auto">
      <div
        className="md:grid items-start gap-4"
        style={{gridTemplateColumns:'.3fr .7fr'}}>
        <div>
          <EditableImage link={image} setLink={setImage} />
        </div>
        <div className="grow">
          <label>Item name</label>
          <input
            type="text"
            value={name}
            onChange={ev => setName(ev.target.value)}
            required
            placeholder="Enter item name"
          />
          <label>Description</label>
          <input
            type="text"
            value={description}
            onChange={ev => setDescription(ev.target.value)}
            placeholder="Enter description (optional)"
          />
          <label>Category:</label>
          <select 
            style={{padding:'2px',border:'2px solid #AB886D', borderRadius:'5px', margin:'10px',cursor:'pointer'}} 
            value={category} 
            onChange={ev => setCategory(ev.target.value)}
            required
          >
            <option value="">Select a category</option>
            {categories?.length > 0 && categories.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
          <div>
            <label>Base price</label>
            <input
              type="number"
              min="0"
              value={basePrice}
              onChange={ev => setBasePrice(ev.target.value)}
              required
              placeholder="0.00"
              style={{padding:'2px',border:'2px solid #AB886D', borderRadius:'5px',margin:'10px'}}
            />
          </div>
          <MenuItemPriceProps name={'Sizes'}
                              addLabel={'Add item size'}
                              props={sizes}
                              setProps={setSizes} />
          <MenuItemPriceProps name={'Extra ingredients'}
                              addLabel={'Add ingredients prices'}
                              props={extraIngredientPrices}
                              setProps={setExtraIngredientPrices}/>
          <button type="submit" style={{marginTop:'30px',cursor:'pointer'}}>Save</button>
        </div>
      </div>
    </form>
  );
}