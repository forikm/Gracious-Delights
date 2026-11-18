import { available } from './domain.js';

const families={
  Crinkles:['crinkles','Crinkles','Chocolate or ube, by the piece or tub.'],
  Cookies:['cookies','Matcha Cookies','100 g matcha cookies, sold individually.'],
  Ensaymada:['ensaymada','Ensaymada','Buttercream ensaymada in six flavors, with assorted packs available.'],
  'Cinnamon Rolls':['cinnamon','Cinnamon Rolls','Cream cheese cinnamon rolls in six flavors, by the piece or pan.'],
  'Yema Cake':['yema','Yema Cake','Classic or ube yema cake, sold per tub.'],
  'Banana Bread':['banana','Banana Bread','Choose a loaf, a square, or a pack of six squares.']
};
export function variantLabels(product){
  const id=product.id;
  if(id.startsWith('sign-ensaymada-pack-'))return {flavor:'Assorted',size:product.portion};
  if(id.startsWith('sign-ensaymada-'))return {flavor:product.name.replace(/ Ensaymada$/,''),size:product.portion};
  if(id.startsWith('sign-cinnamon-'))return {flavor:product.name.split(' Cinnamon Roll')[0],size:product.portion};
  if(id.includes('crinkles-'))return {flavor:product.name.split(' Crinkles')[0],size:product.portion};
  if(id.startsWith('sign-yema-cake-'))return {flavor:product.name.startsWith('Ube')?'Ube':'Classic',size:product.portion};
  if(product.category==='Banana Bread')return {flavor:product.name.replace(' — Pack of 6',''),size:product.portion};
  return {flavor:product.name,size:product.portion};
}
export function catalogGroups(state,{category='All delights',query='',inStock=false,sort='featured'}={}){
  const groups=new Map();
  for(const product of state.products.filter(p=>p.active)){
    const family=product.id.startsWith('sign-')?families[product.category]:null;
    const key=family?`family-${family[0]}`:product.id;
    if(!groups.has(key))groups.set(key,{id:key,name:family?.[1]||product.name,description:family?.[2]||product.description,category:product.category,variants:[]});
    groups.get(key).variants.push(product);
  }
  const search=query.toLowerCase().trim();
  let result=[...groups.values()].filter(group=>category==='All delights'||group.category===category);
  result=result.map(group=>({...group,matches:group.variants.filter(p=>(!inStock||available(state,p)>0)&&`${group.name} ${p.name} ${p.description} ${p.category}`.toLowerCase().includes(search))})).filter(g=>g.matches.length);
  for(const group of result){
    group.stock=group.matches.reduce((sum,p)=>sum+available(state,p),0);
    group.photo=group.matches.find(p=>available(state,p)>0)||group.matches.find(p=>p.image.startsWith('assets/facebook/'))||group.matches[0];
    group.minPrice=Math.min(...group.matches.map(p=>p.price));
    group.maxPrice=Math.max(...group.matches.map(p=>p.price));
  }
  return result.sort((a,b)=>sort==='price-asc'?a.minPrice-b.minPrice:sort==='price-desc'?b.maxPrice-a.maxPrice:sort==='name'?a.name.localeCompare(b.name):Number(b.stock>0)-Number(a.stock>0));
}
