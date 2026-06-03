export type CardBrand = 'visa' | 'mastercard' | 'unknown'

export interface CardValidation {
  brand: CardBrand
  cardDigits: string
  expiryDigits: string
  cvcDigits: string
  cardError: string
  expiryError: string
  cvcError: string
  isValid: boolean
}

export function digitsOnly(value: string, maxLength?: number) {
  const digits = value.replace(/\D/g, '')
  return typeof maxLength === 'number' ? digits.slice(0, maxLength) : digits
}

export function detectCardBrand(cardNumber: string): CardBrand {
  const digits = digitsOnly(cardNumber, 16)
  if (digits.startsWith('4')) return 'visa'

  const firstTwo = Number(digits.slice(0, 2))
  const firstFour = Number(digits.slice(0, 4))
  if ((firstTwo >= 51 && firstTwo <= 55) || (firstFour >= 2221 && firstFour <= 2720)) {
    return 'mastercard'
  }

  return 'unknown'
}

export function formatCardNumber(value: string) {
  return digitsOnly(value, 16).replace(/(\d{4})(?=\d)/g, '$1 ')
}

export function formatExpiry(value: string) {
  const digits = digitsOnly(value, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

export function formatCvc(value: string) {
  return digitsOnly(value, 3)
}

export function luhnCheck(cardNumber: string) {
  const digits = digitsOnly(cardNumber)
  let sum = 0
  let shouldDouble = false

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i])
    if (shouldDouble) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    shouldDouble = !shouldDouble
  }

  return digits.length > 0 && sum % 10 === 0
}

export function isExpiryValid(expiry: string) {
  const digits = digitsOnly(expiry, 4)
  if (digits.length !== 4) return false

  const month = Number(digits.slice(0, 2))
  const year = Number(`20${digits.slice(2)}`)
  if (month < 1 || month > 12) return false

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  return year > currentYear || (year === currentYear && month >= currentMonth)
}

export function validateCard(cardNumber: string, expiry: string, cvc: string): CardValidation {
  const cardDigits = digitsOnly(cardNumber, 16)
  const expiryDigits = digitsOnly(expiry, 4)
  const cvcDigits = digitsOnly(cvc, 3)
  const brand = detectCardBrand(cardDigits)

  let cardError = ''
  if (cardDigits.length !== 16) {
    cardError = 'Введите 16 цифр карты'
  } else if (brand === 'unknown') {
    cardError = 'Поддерживаются только Visa и Mastercard'
  } else if (!luhnCheck(cardDigits)) {
    cardError = 'Номер карты введен неверно'
  }

  let expiryError = ''
  if (expiryDigits.length !== 4) {
    expiryError = 'Введите срок в формате ММ/ГГ'
  } else if (!isExpiryValid(expiryDigits)) {
    expiryError = 'Срок действия карты неверный'
  }

  let cvcError = ''
  if (cvcDigits.length !== 3) {
    cvcError = 'Введите 3 цифры CVC'
  }

  return {
    brand,
    cardDigits,
    expiryDigits,
    cvcDigits,
    cardError,
    expiryError,
    cvcError,
    isValid: !cardError && !expiryError && !cvcError,
  }
}

export function cardBrandLabel(brand: CardBrand) {
  if (brand === 'visa') return 'Visa'
  if (brand === 'mastercard') return 'Mastercard'
  return 'Карта'
}
