export interface StoreStyle {
  name: string;
  color: string;       // Hex color for tab/indicator
  textColor: string;
  borderColor: string;
  bgColor: string;
}

export const STORE_STYLES: Record<string, StoreStyle> = {
  'Amazon': {
    name: 'Amazon',
    color: '#9A6B2F', // Âmbar queimado
    textColor: '#845722',
    borderColor: '#E8D2BD',
    bgColor: '#FAF4EC',
  },
  'Mercado Livre': {
    name: 'Mercado Livre',
    color: '#9E851E', // Amarelo mostarda
    textColor: '#7D6912',
    borderColor: '#EFE2B3',
    bgColor: '#FCF9EB',
  },
  'Magalu': {
    name: 'Magalu',
    color: '#476982', // Azul acinzentado
    textColor: '#365368',
    borderColor: '#CCD9E3',
    bgColor: '#F2F6F9',
  },
  'Kabum': {
    name: 'Kabum',
    color: '#B45309', // Laranja outonal
    textColor: '#92400E',
    borderColor: '#F3D2BA',
    bgColor: '#FDF5EE',
  },
  'Shopee': {
    name: 'Shopee',
    color: '#BD5E48', // Coral terroso
    textColor: '#9B4530',
    borderColor: '#F6D2CA',
    bgColor: '#FDF4F2',
  },
  'Outra': {
    name: 'Outra',
    color: '#78716C', // Cinza argila
    textColor: '#57534E',
    borderColor: '#E7E5E4',
    bgColor: '#F5F5F4',
  },
};

export function getStoreStyle(storeName: string): StoreStyle {
  const match = Object.keys(STORE_STYLES).find((key) =>
    key.toLowerCase() === (storeName || '').toLowerCase()
  );
  if (match) return STORE_STYLES[match];

  return {
    name: storeName || 'Loja',
    color: '#78716C',
    textColor: '#57534E',
    borderColor: '#E7E5E4',
    bgColor: '#F5F5F4',
  };
}
