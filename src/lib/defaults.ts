import type { Business, Category } from './types.ts'

export const CAFE_REVENUE = 'cafe-revenue'
export const CAFE_OTHER_INCOME = 'cafe-other-income'
export const CAFE_GOODS = 'cafe-goods'
export const CAFE_PAYROLL = 'cafe-payroll'
export const CAFE_RENT = 'cafe-rent'
export const CAFE_UTILITIES = 'cafe-utilities'
export const CAFE_MARKETING = 'cafe-marketing'
export const CAFE_EVENT = 'cafe-event'
export const CAFE_TAX = 'cafe-tax'
export const CAFE_LABOR = 'cafe-labor'
export const CAFE_INSURANCE = 'cafe-insurance'
export const CAFE_TABLEWARE = 'cafe-tableware'
export const CAFE_DECOR = 'cafe-decor'
export const CAFE_WELFARE = 'cafe-welfare'
export const CAFE_REPAIR = 'cafe-repair'
export const CAFE_CLEANING = 'cafe-cleaning'
export const CAFE_MISC = 'cafe-misc'
export const CAFE_SETTLEMENT = 'cafe-settlement'

export const LAYA_FRANCHISE = 'laya-franchise'
export const LAYA_DEPOSIT = 'laya-deposit'
export const LAYA_FITOUT = 'laya-fitout'
export const LAYA_EQUIPMENT = 'laya-equipment'
export const LAYA_INGREDIENTS = 'laya-ingredients'
export const LAYA_RENT = 'laya-rent'
export const LAYA_PAYROLL = 'laya-payroll'
export const LAYA_REVENUE = 'laya-revenue'
export const LAYA_MISC = 'laya-misc'

function category(id: string, name: string, kind: Category['kind']): Category {
  return { id, name, kind }
}

export function cafeCategories(): Category[] {
  return [
    category(CAFE_REVENUE, '營收', 'income'),
    category(CAFE_OTHER_INCOME, '其他收入', 'income'),
    category(CAFE_GOODS, '食材進貨', 'expense'),
    category(CAFE_PAYROLL, '薪資', 'expense'),
    category(CAFE_RENT, '房租', 'expense'),
    category(CAFE_UTILITIES, '水電', 'expense'),
    category(CAFE_MARKETING, '行銷', 'expense'),
    category(CAFE_EVENT, '活動表演', 'expense'),
    category(CAFE_TAX, '稅務', 'expense'),
    category(CAFE_LABOR, '勞健保', 'expense'),
    category(CAFE_INSURANCE, '保險', 'expense'),
    category(CAFE_TABLEWARE, '餐具器材', 'expense'),
    category(CAFE_DECOR, '佈置裝飾', 'expense'),
    category(CAFE_WELFARE, '員工福利', 'expense'),
    category(CAFE_REPAIR, '修繕設備', 'expense'),
    category(CAFE_CLEANING, '清潔回收', 'expense'),
    category(CAFE_MISC, '雜支', 'expense'),
    category(CAFE_SETTLEMENT, 'Line Pay 撥款', 'settlement'),
  ]
}

export function layaCategories(): Category[] {
  return [
    category(LAYA_FRANCHISE, '加盟/開辦費', 'expense'),
    category(LAYA_DEPOSIT, '押金/保證金', 'expense'),
    category(LAYA_FITOUT, '裝潢工程', 'expense'),
    category(LAYA_EQUIPMENT, '設備', 'expense'),
    category(LAYA_INGREDIENTS, '食材', 'expense'),
    category(LAYA_RENT, '房租', 'expense'),
    category(LAYA_PAYROLL, '薪資', 'expense'),
    category(LAYA_REVENUE, '營收', 'income'),
    category(LAYA_MISC, '雜支', 'expense'),
  ]
}

export function defaultBusinesses(): Business[] {
  return [
    {
      id: 'cafe',
      name: '諾奇意咖啡',
      englishName: 'Nose.Y Café',
      place: '桃園',
      phase: 'operating',
      description: '已在營業的寵物友善咖啡店。',
      sharePercent: null,
      startup: false,
      categories: cafeCategories(),
    },
    {
      id: 'laya',
      name: '拉亞漢堡 新莊店',
      englishName: 'Laya Burger',
      place: '新莊',
      phase: 'preopening',
      description: '早餐加盟店，籌備中。合約由合夥人簽署，持股比例還沒定。',
      sharePercent: null,
      startup: true,
      categories: layaCategories(),
    },
  ]
}

export function findBusiness(businesses: Business[], id: string): Business | undefined {
  return businesses.find((business) => business.id === id)
}

export function findCategory(businesses: Business[], categoryId: string): Category | undefined {
  for (const business of businesses) {
    const category = business.categories.find((item) => item.id === categoryId)
    if (category) return category
  }
  return undefined
}
