// This file is part of register.js.  Copyright 2011 Joshua Partlow.  This program is free software, licensed under the terms of the GNU General Public License.  Please see the LICENSE file in this distribution for more information, or see http://www.gnu.org/copyleft/gpl.html.

////////////////////////
/* Simple Inheritance */
////////////////////////

Function.prototype.inherits = function(parent_function) { 
  this.prototype = new parent_function
  this.prototype.constructor = this
  this.prototype.parent = parent_function.prototype
  return this
} 

/////////////////////////
/* Object Utilities    */
/////////////////////////

Object.extend(Object, {
  is_null_or_undefined: function(object) {
    return object === null || typeof(object) == 'undefined'
  },

  // Looks up the given property on the given object.  If it is a function, applies
  // it with the given array of arguments and returns the value, otherwise just
  // returns the value.
  __send: function(object, property, args) {
    var value = object[property]
    if (typeof(value) == 'function') {
      value = value.apply(object, args)
    }
    return value
  },
})

/////////////////////////
/* Array methods       */
/////////////////////////

// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
  var rest = this.slice((to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
}

// Sums all the elements of an array.
//
// If a property is passed, each element is tested for the property.
//
// If it exists, and is a function, then it is called and the returned value is added.
//
// If it exists, but is not a function, then it is added.
//
// Otherwise, the element itself is added.
//
// Each value is coerced with parseFloat().  If the result is NaN it
// is excluded from the sum.
//
// (The default property to be tested is 'value' if none is given)
//
// The sum of an empty array is undefined.
//
// Examples:
//
//   [].sum() // => undefined
//   [1,2,3].sum() // => 6
//   ['1','2','foo'].sum() // => 3
//   [{ value: 2 }, { value: 5 }, { value: 3}].sum() // => 10
//   [{ amount: '1' }, { amount: '2' }, {}].sum('amount') // => 3
//
Array.prototype.sum = function(property_name) {
  if (this.length == 0) { return undefined }
  property_name = property_name || 'value'
  return this.inject(0, function(sum, v) {
    var value
    var property = v[property_name]
    switch (typeof(property)) {
      case 'undefined': value = v; break
      case 'function': value = v[property_name](); break
      default: value = property
    }
    value = parseFloat(value)
    return (isNaN(value) ? sum : (sum + value))
  })
}

// Returns all form controls which are not disabled, not visible, and
// not Input[type] == 'hidden'
//
// If an ancestor is provided, then the elements must also be children
// of this ancestor (useful for obtaining a subset of form controls).
var FormUtils = {
  get_enabled_elements: function(element, ancestor) {
    return element.getElements().reject(function(e) { 
      var reject = e.disabled || !e.visible() || e.type == 'hidden'
      if (ancestor instanceof Element) {
        reject = reject || !e.ancestors().include(ancestor)
      }
      return reject
    })
  }
}
Element.addMethods('form', FormUtils)
