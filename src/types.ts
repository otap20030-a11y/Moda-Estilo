export interface Product {
  id: string;
  name: string;
  price: number;
  category: 'Ropa' | 'Accesorios';
  description: string;
  image: string;
  color: string;
}

export interface CartItem extends Product {
  quantity: number;
}
