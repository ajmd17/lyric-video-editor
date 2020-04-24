class DynamicValue {
  value(effectStateData) {
    throw Error('Not implemented')
  }
}

class DynamicNumber extends DynamicValue {
  /**
   * 
   * @param {number} val 
   */
  constructor(val) {
    super()

    this.val = val
  }

  value(effectStateData) {
    return this.val
  }
}

class Interpolation extends DynamicValue {
  /**
   * 
   * @param {number | DynamicValue} a 
   * @param {number | DynamicValue} b 
   * @param {number | DynamicValue} val 
   */
  constructor(a, b, val) {
    super()

    this.a = a
    this.b = b
    this.val = val
  }

  value(effectStateData) {
    let a = (this.a instanceof DynamicValue) ? this.a.value(effectStateData) : this.a
    let b = (this.b instanceof DynamicValue) ? this.b.value(effectStateData) : this.b
    let val = (this.val instanceof DynamicValue) ? this.val.value(effectStateData) : this.val

    return lerp(a, b, val)
  }
}

class DynamicTuple extends DynamicValue {
  /**
   * 
   * @param {number | DynamicValue} a 
   * @param {number | DynamicValue} b 
   */
  constructor(a, b) {
    super()

    this.a = a
    this.b = b

    if (typeof b === 'undefined') {
      this.b = a
    }
  }

  value(effectStateData) {
    let a = (this.a instanceof DynamicValue) ? this.a.value(effectStateData) : this.a
    let b = (this.b instanceof DynamicValue) ? this.b.value(effectStateData) : this.b

    return [a, b]
  }
}

class Proc extends DynamicValue {
  /**
   * 
   * @param {Function} fun 
   */
  constructor(fun) {
    super()

    this.fun = fun
  }

  value(effectStateData) {
    return this.fun(effectStateData)
  }
}