import { available } from './domain.js';
import { CAKES, COOKIES, productCategory, SWEET_BREADS } from './menu-catalog.js';

// Family IDs follow the variant SKUs so category changes do not break selectors.
const families = [
  {prefix:/^sign-(?:chocolate|ube)-crinkles-/, id:'crinkles', category:COOKIES, name:'Crinkles', description:'Chocolate or ube, by the piece or tub.'},
  {prefix:/^sign-matcha-cookie$/, id:'cookies', category:COOKIES, name:'Matcha Cookies', description:'100 g matcha cookies, sold individually.'},
  {prefix:/^sign-ensaymada-/, id:'ensaymada', category:SWEET_BREADS, name:'Ensaymada', description:'Buttercream ensaymada in six flavors, with assorted packs available.'},
  {prefix:/^sign-cinnamon-/, id:'cinnamon', category:SWEET_BREADS, name:'Cinnamon Rolls', description:'Cream cheese cinnamon rolls in six flavors, by the piece or pan.'},
  {prefix:/^sign-yema-cake-/, id:'yema', category:CAKES, name:'Yema Cake', description:'Classic or ube yema cake, sold per tub.'},
  {prefix:/^sign-banana-/, id:'banana', category:SWEET_BREADS, name:'Banana Bread', description:'Choose a loaf, a square, or a pack of six squares.'}
];
export function variantLabels(product){
  const id=product.id;
  if(id.startsWith('sign-ensaymada-pack-'))return {flavor:'Assorted',size:product.portion};
  if(id.startsWith('sign-ensaymada-'))return {flavor:product.name.replace(/ Ensaymada$/,''),size:product.portion};
  if(id.startsWith('sign-cinnamon-'))return {flavor:product.name.split(' Cinnamon Roll')[0],size:product.portion};
  if(id.includes('crinkles-'))return {flavor:product.name.split(' Crinkles')[0],size:product.portion};
  if(id.startsWith('sign-yema-cake-'))return {flavor:product.name.startsWith('Ube')?'Ube':'Classic',size:product.portion};
  if(id.startsWith('sign-banana-'))return {flavor:product.name.replace(' — Pack of 6',''),size:product.portion};
  return {flavor:product.name,size:product.portion};
}
export function catalogGroups(state,{category='All delights',query='',inStock=false,sort='featured'}={}){
  const groups=new Map();
  for(const product of state.products.filter(p=>p.active)){
    const family = families.find(({prefix}) => prefix.test(product.id));
    const displayCategory = productCategory(product);
    const familyKey = family && `family-${family.id}`;
    const key = !family ? product.id : displayCategory === family.category ? familyKey : `${familyKey}-${displayCategory}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id:key, name:family?.name || product.name, description:family?.description || product.description,
        category:displayCategory, optionLabel:family?.id === 'banana' ? 'Product' : 'Flavor', variants:[]
      });
    }
    groups.get(key).variants.push(product);
  }
  const search=query.toLowerCase().trim();
  let result=[...groups.values()].filter(group=>category==='All delights'||group.category===category);
  result=result.map(group=>({...group,matches:group.variants.filter(p=>(!inStock||available(state,p)>0)&&`${group.name} ${p.name} ${p.description} ${group.category}`.toLowerCase().includes(search))})).filter(g=>g.matches.length);
  for(const group of result){
    group.stock=group.matches.reduce((sum,p)=>sum+available(state,p),0);
    group.photo=group.matches.find(p=>available(state,p)>0)||group.matches.find(p=>p.image.startsWith('assets/facebook/'))||group.matches[0];
    group.minPrice=Math.min(...group.matches.map(p=>p.price));
    group.maxPrice=Math.max(...group.matches.map(p=>p.price));
  }
  return result.sort((a,b)=>sort==='price-asc'?a.minPrice-b.minPrice:sort==='price-desc'?b.maxPrice-a.maxPrice:sort==='name'?a.name.localeCompare(b.name):Number(b.stock>0)-Number(a.stock>0));
}
