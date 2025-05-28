export type Domain = "coupang" | "11st";

export interface CrawlRequest {
  url: string;
  domain: Domain;
}

export interface Product {
  product_id: string; // 상품 ID
  title: string; // 상품명
  image: string; // 대표 이미지 URL
  price: number; // 가격
  model_name: string; // 모델명
  shipping_fee: number; // 배송비
  return_fee: number | null; // 반품 비용 (없으면 null)
  soldout: boolean; // 품절 여부
  domain: Domain; // 크롤링 대상 도메인
  options?: string[]; // 상품 옵션 목록
}

export interface CrawlResponse {
  success: boolean;
  data?: Product;
  error?: string;
}

export interface ICrawler {
  crawl(): Promise<Product>;
}
