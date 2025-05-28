export interface UrlRow {
  id: number;
  domain: string;
  url: string;
  name: string | null;
}

export interface ResultRow {
  id: number;
  url_id: number;
  product_id: string;
  title: string;
  image: string;
  price: number;
  model_name: string;
  shipping_fee: number;
  return_fee: number;
  soldout: boolean;
  crawled_at: string;
  inserted_at: string;
  updated_at: string;
}

export interface Database {
  urls: UrlRow;
  results: ResultRow;
}
