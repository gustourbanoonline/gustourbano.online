
export type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image_url: string;
  active: boolean;
};

export type Zone = {
  id: string;
  name: string;
  fee: number;
  active: boolean;
};

export type CartLine = {
  product: Product;
  quantity: number;
  note: string;
};

export type Order = {
  id: string;
  order_number: number;
  customer_name: string;
  customer_phone: string;
  address: string;
  neighborhood: string;
  notes: string;
  items: {
    name: string;
    quantity: number;
    price: number;
    note?: string;
  }[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  payment_method: string;
  payment_status: string;
  payment_proof: string;
  status: string;
  created_at: string;
};
