// This file is part of register.js.  Copyright 2011 Joshua Partlow.  This program is free software, licensed under the terms of the GNU General Public License.  Please see the LICENSE file in this distribution for more information, or see http://www.gnu.org/copyleft/gpl.html.

//////////////////////
/* Register.Payment */
//////////////////////

// General information about the payment.
Register.Payment = function(register, config) {
  this._register = register
  this.initialize(config)
}
Register.Payment.inherits(Register.Core)
Object.extend(Register.Payment.prototype, {
  initialize: function(config) {
    this.config = config || {}
    this.fields = $A([])
    var prop
    for (prop in config) {
      this.fields.push(prop)
      if (Object.isUndefined(this[prop])) {
        this[prop] = config[prop]
      }
    }
    this.new = this.id ? false : true
  },

  // Returns the payment Register.Code matching our type.
  code: function() {
    return this._register.find_code_by('payment_type', this.type) 
  },
 
  // Returns true if this is a new payment that has not been saved
  // server side yet.  Otherwise we are making an update to an existing
  // payment.
  is_new: function() {
    return this.new
  },
})

/////////////////////
/* Register.Ledger */
/////////////////////

// The Register.Ledger is the collection of all ledger entries which
// together will make up the accounting transaction being processed by this
// payment.
Register.Ledger = function(register, config) {
  this.register = register
  this.config = config || {}
  this.rows = $A()
  $A(this.config.rows || []).each(function(row_config) { this.add(row_config) }, this)
}
Register.Ledger.inherits(Register.Core)
Object.extend(Register.Ledger.prototype, Register.Events.handler_for('update'))
Object.extend(Register.Ledger.prototype, {
  // Number of ledger entries.
  count: function(old_or_new) {
    return this.get_rows(old_or_new).length
  },

  // Add a new LedgerRow for the given type, code and amount.
  // Throws Register.Exceptions.LedgerException if cannot determine a code from code_id.
  // Alternately, if passed a single object, it assumes it is a configuration object
  // for an existing LedgerRow and tries to instantiate from it.
  add: function(type, code_id, amount) {
    var new_row
    if (arguments.length == 1 && typeof(arguments[0]) == "object") {
      new_row = new Register.LedgerRow(arguments[0]) 
    } else {
      var code = this.register.find_code(code_id)
      if (!code) { throw(new Register.Exceptions.LedgerException('add', 'Cannot add a new row to the Ledger without a Register.Code')) }
  
      var debit, credit
      switch (code.debit_or_credit) {
        case 'D': debit = amount; break
        case 'C': credit = amount; break
        default: throw(new Register.Exceptions.LedgerException('add', "Register.Code.debit_or_credit of unknown type: '#{type}'", { type: code.debit_or_credit }))
      }
      var new_row = new Register.LedgerRow({
        code_type: type,
        code: code,
        debit: debit,
        credit: credit,
      })
    }
    this.rows.push(new_row)
    if (new_row.is_new()) {
      // Registers a remove call with the row's 'destroy' listener so that we remove
      // the row from the ledger array when it is destroyed.
      new_row.add_listener('destroy', this.remove.bind(this))
      if (new_row.is_purchase()) { 
        new_row.add_listener('update', this.update.bind(this))
      }
    }
    // update ledger totals and notify listeners.
    this.update()
    return new_row
  },

  // Add a purchase LedgerRow.
  add_purchase: function(code_id, amount) { 
    return this.add(Register.LedgerRow.PURCHASE_TYPE, code_id, amount)
  },

  // Removes the given row from the ledger.
  remove: function(row) {
    this.rows.remove(this.rows.indexOf(row)) 
    if (row.is_purchase()) {
      this.update()
    }
  },

  // Returns amount tendered by the customer, if it has been set, or the 
  // current new purchase total.
  get_amount_tendered_or_credited: function() {
    return this._amount_tendered || this.get_purchase_total('new')
  },

  // Can be set to override the amount the customer is actually paying,
  // typically if they pay with more cash than the purchase total and are
  // therefore due change.
  set_amount_tendered: function(tendered) {
    var amount_tendered = this.parseMoney(tendered)
    this._amount_tendered = isNaN(amount_tendered) ? undefined : amount_tendered
    this.update()
    return this
  },

  // Sets the payment Register.Code, resets the associated new payment
  // Ledger.Row and returns it.
  set_payment_code: function(code_or_code_id) {
    var new_code = code_or_code_id
    if (!(code_or_code_id instanceof Register.Code)) {
      new_code = this.register.payment_codes.lookup(code_or_code_id)
    }
    if (this.payment_code != new_code) {
      this.__reset_payment(new_code)
    }
    return this.payment_row()
  },

  // Recalculates the change row value based on current purchase total less payment.
  recalculate_change: function() {
    var change = this.get_payment_total('new') - this.get_purchase_total('new')
    if (change == 0) {
      this.__destroy_change()
    } else {
      if (!this.change_row()) {
        if (this.payment_code) {
          // add (-1 * change) because we are returning Cash, but the code is for payment
          // and defaults to debit, so we need to flip it to credit
          this.add(Register.LedgerRow.CHANGE_TYPE, this.register.change_code().id, -1 * change)
        }
      } else {
        this.change_row().set_credit(change)
      }
    }
    return change
  },

  // Recalculates the payment row value based on current purchase total, or
  // amount_tendered if that has been set.
  recalculate_payment: function() {
    var payment = this.get_amount_tendered_or_credited()
    if (payment == 0) {
      this.__destroy_payment()
    } else {
      if (!this.payment_row()) {
        if (this.payment_code && !(this.payment_code instanceof Register.AdjustmentCode)) {
          this.add(Register.LedgerRow.PAYMENT_TYPE, this.payment_code.id, payment)
        }
      } else {
        this.payment_row().set_debit(payment)
      }
    }
  },

  // Update the ledger totals and fire the update event to notify listening objects
  // like the UI.
  update: function() {
    try {
      if (!this.__updating__) {
          this.__updating__ = true
          this.recalculate_payment()
          this.recalculate_change()
          this.fire('update')
      }
    } finally {
      this.__updating__ = false
    }
    return true
  },

  // (Re)initializes a new payment row.
  __reset_payment: function(new_code) {
    this.__destroy_payment() 
    this.payment_code = new_code
    this.update()
    return true
  },

  __destroy_payment: function() {
    if (this.payment_row()) { this.payment_row().destroy() }
  },

  __destroy_change: function() {
    if (this.change_row()) { this.change_row().destroy() }
  },

  __rows_by_type: function(code_type, config) {
    config = config || {}
    var old_or_new = config['old_or_new']
    return this.rows.select(function(e) { 
      return (code_type == 'all' ? true : e.code_type == code_type) && (
        old_or_new == 'new' ?
          e.is_new() :
          old_or_new == 'old' ?
            !e.is_new() :
            true // either old or new
      )
    })
  },

  // Get all ledger rows, old or new or both.
  get_rows: function(old_or_new) {
    return this.__rows_by_type('all', { old_or_new: old_or_new })
  },

  // Get the purchase rows, both old and new.
  // If you pass 'old' you will get only the old saved rows, if any.
  // If you pass 'new' you will get only the new unsaved rows.
  // The default is both.
  purchase_rows: function(old_or_new) {
    return this.__rows_by_type(Register.LedgerRow.PURCHASE_TYPE, { old_or_new: old_or_new })
  },

  // Get the payment rows, both old and new.
  // Same options as purchase_rows.
  payment_rows: function(old_or_new) {
    return this.__rows_by_type(Register.LedgerRow.PAYMENT_TYPE, { old_or_new: old_or_new })
  },

  // Return the new payment row, if there is one.
  payment_row: function() {
    return this.payment_rows('new').first()
  },

  // Get the change rows, both old and new
  // Same options as purchase_rows.
  change_rows: function(old_or_new) {
    return this.__rows_by_type(Register.LedgerRow.CHANGE_TYPE, { old_or_new: old_or_new })
  },

  // Return the new change row, if there is one.
  change_row: function() {
    return this.change_rows('new').first()
  },

  // Total value of purchase ledger entries.
  // Same options as purchase_rows.
  get_purchase_total: function(old_or_new) {
    return this.purchase_rows(old_or_new).sum('get_credit_or_debit') || 0
  },

  // Total value of payment ledger entries.
  get_payment_total: function(old_or_new) {
    return this.payment_rows(old_or_new).sum('get_debit_or_credit') || 0
  },

  // Get the total amount tendered by the customer.
  // (This will always be positive)
  get_tendered_total: function(old_or_new) {
    return this.payment_rows(old_or_new).sum('get_debit') || 0
  },

  // Get the total amount credited back to the customer.
  // (This will always be positive)
  get_credited_total: function(old_or_new) {
    return this.payment_rows(old_or_new).sum('get_credit') || 0
  },

  // Get the change owed to the customer.
  get_change_total: function(old_or_new) {
    return this.change_rows(old_or_new).sum('get_credit_or_debit') || 0
  },

  // Get the total register debits.
  get_debits_total: function(old_or_new) {
    return this.__rows_by_type('all', { old_or_new: old_or_new }).sum('get_debit') || 0
  },

  // Get the total register credits.
  get_credits_total: function(old_or_new) {
    return this.__rows_by_type('all', { old_or_new: old_or_new }).sum('get_credit') || 0
  },

  // Serialize all of the new ledger row data as an array of objects.
  serialize: function() {
    return this.__rows_by_type('all', { old_or_new: 'new' }).map(function(r) { 
      return r.serialize()
    }).toArray()
  },

  // True if we are reversing an existing payment, and there are old rows in
  // the ledger that we have to balance against.
  reversing: function() {
    return this.get_rows('old').length > 0
  },

  // If we are reversing an existing payment, each new row must be less
  // than or equal to the reverse of existing rows.
  validate_reversal: function() {
    var errors = $A([])
    var indexer = function(hash, row) {
      var array = hash.get(row.register_code) || hash.set(row.register_code, $A([]))
      array.push(row)
      return hash
    }
    var old_indexed = this.get_rows('old').inject($H({}), indexer)
    var new_indexed = this.get_rows('new').inject($H({}), indexer)
    
    new_indexed.each(function(entry) {
      var code = entry[0]
      var new_rows = entry[1]
      var old_rows = old_indexed.get(code)
      if (!old_rows) {
        errors.push('there was no code ' + code + ' in the original payment')
      } else if (
        (old_rows.sum('get_debit') < new_rows.sum('get_credit')) ||
        (old_rows.sum('get_credit') < new_rows.sum('get_debit'))
      ) {
        errors.push('you cannot reverse more than the original payment for ' + code)
      }
    }, this) 
    return errors
  },

  // Checks that register is in a valid state.
  // * debits and credits must balance
  // * change cannot be negative
  // * new totals must balance against old totals if we are updating an existing payment
  // * amount tendered must be positive for payment
  // * amount credited must be positive for credit
  // * payment and change must be zero for adjustment
  // * unless we are cashing a check, there must be ledger rows
  // * enabled required fields should be present
  validate: function() {
    this.errors = $A([])
    var debits = this.get_debits_total('new')
    var credits = this.get_credits_total('new')
    var tendered = this.get_tendered_total('new')
    var credited = this.get_credited_total('new')
    var change = this.get_change_total('new')
    if ( change < 0 ) {
      this.errors.push('you may not return negative change...')
    }
    if (this.reversing()) {
      this.errors = this.errors.concat(this.validate_reversal())
    } else if (this.payment_code instanceof Register.PaymentCode) {
      if (tendered <= 0) {
        this.errors.push('amount tendered must be positive for a payment')
      }
    } else if (this.payment_code instanceof Register.AdjustmentCode) {
      if ([tendered, credited, change].any(function(e) { return e != 0 })) {
        this.errors.push('payment and change must both be zero if you are adjusting internal accounts')
      }
    } else if (this.credit_code instanceof Register.CreditCode) {
      if (credited <= 0) {
        this.errors.push('amount credited must be positive for a credit')
      }
    }
    if (debits != credits) {
      this.errors.push('debits and credits do not balance (debits must equal credits)')
    }
    if ((!this.payment_code.is_check() && this.purchase_rows().length == 0) || (this.purchase_rows('old').length > 0 && this.purchase_rows('new').length == 0)) {
      this.errors.push('no purchase codes have been entered')
    }
    return this.errors.length == 0
  },

})

////////////////////////
/* Register.LedgerRow */
////////////////////////

// A debit or credit associated with an account.
// Config may be an Object of raw ledger entry fields as returned by the server,
// or code_type, code and amount for new ledger rows.
//
// A config object of raw ledger row data should have:
// * id: unique id for the row (only if saved, may be blank if returning from failed
//   validation...see read_only below)
// * type: GL account type (Asset, Liability, Income or Expense)
// * account_number: GL account number string ('1000.000' for example)
// * account_name: longhand GL account name
// * detail: a string with detail information about the row
// * register_code: unique shorthand code associated with the Register.Code
//   that generated this row (this is different than the GL account_code or
//   account_name, since multiple register codes might be tied to the same
//   account)
// * debit: debit amount
// * credit: credit amount
// * code_label: the longhand label associated with the Register.Code that
//   generated this row
// * code_type: purchase, payment or change
//
// NOTE: Only debit or credit should have a value, not both.  
//
// The reason an existing ledger row
// configuration contains all of the account code/register code information directly rather
// than just referencing a Register.Code the way a new instance does, is because we may be
// making an adjustment to an existing payment from the past, and register codes may
// have been reconfigured since then.
//
// Generating a new LedgerRow from code would expect:
// * code_type: as above
// * code: a Register.Code instance
// * debit: debit amount OR
// * credit: credit amount
//
// NOTE: only one of either debit or credit should be present.
//
// Throws Register.Exceptions.LedgerRowException if both debit, credit are set,
// if amount is 0 or not a number, or if the code_type is not one of
// Register.LedgerRow.TYPES.
//
// Properties
//
// * read_only: (boolean) Existing ledger rows returned by the server may be
//   marked read-only if they are ledger entries which have already been
//   processed (if they have an id).  This is as opposed to unsaved ledger
//   entries returned during creation of a new payment due to validation errors.
Register.LedgerRow = function(config) {
  this.config = config || {}
  this.code = this.config.code || {}
  this.initialize()
}
Register.LedgerRow.inherits(Register.Core)
// Constants
Register.LedgerRow.PURCHASE_TYPE = 'purchase'
Register.LedgerRow.PAYMENT_TYPE = 'payment'
Register.LedgerRow.CHANGE_TYPE = 'change'
Register.LedgerRow.TYPES = $A([Register.LedgerRow.PURCHASE_TYPE, Register.LedgerRow.PAYMENT_TYPE, Register.LedgerRow.CHANGE_TYPE])
// Methods
Object.extend(Register.LedgerRow.prototype, Register.Events.handler_for('update', 'destroy'))
Object.extend(Register.LedgerRow.prototype, {
  initialize: function() {
    // set defaults from either this.config or this.code if available
    var set_default = function (args) {
      var fields = $A([args]).flatten()
      var ledger_row_field_name = fields[0]
      var code_field_name = fields[1] || ledger_row_field_name
      this[ledger_row_field_name] = this.config[ledger_row_field_name] || this.code[code_field_name]
    }.bind(this)
    $A([
      // LedgerRow.field_name, Code.field_name
      ['type', 'account_type'],
      'account_number',
      'account_name',
      ['register_code', 'code'],
      ['code_label', 'label'],
      'detail',
      'code_type',
    ]).each(set_default)

    if (!Register.LedgerRow.TYPES.include(this.code_type)) {
      throw(new Register.Exceptions.LedgerRowException('initialize', "Cannot initialize a LedgerRow whose code_type is not in Register.LedgerRow.TYPES: '#{type}'", { type: this.code_type }))
    } else if (this.config.credit && this.config.debit) {
      throw(new Register.Exceptions.LedgerRowException('intialize', "Cannot initialize a LedgerRow with both credit (#{credit}) and debit (#{debit}) values.", { credit: this.config.credit, debit: this.config.debit }))
    }

    var amount
    if (amount = this.config.debit) { this.set_debit(amount) }
    if (amount = this.config.credit) { this.set_credit(amount) }
    if (this.get_amount() == 0) {
      throw(new Register.Exceptions.LedgerRowException('initialize', "LedgerRow amount must be non-zero"))
    }
    // A row is read-only if it has an id (has been saved on the server)
    // (must be set /after/ amount is initialized above)
    this.read_only = this.config.id ? true : false
  },

  // True if this is a new row which has not yet been saved on the server.
  is_new: function() {
    return !this.read_only
  },

  get_label: function() {
    return this.code_label
  },

  get_debit: function() {
    return this.debit 
  },

  set_debit: function(amount) {
    return this.__set_amount(amount, 'debit')    
  },

  // True if the ledger row is a debit amount.
  is_debit: function() {
    return this.debit ? true : false
  },

  get_credit: function() {
    return this.credit
  },

  set_credit: function(amount) {
    return this.__set_amount(amount, 'credit')    
  },

  // True if the ledger row is a credit amount.
  is_credit: function() {
    return this.credit ? true : false
  },

  // Returns the credit or debit amount as a signed amount depending on account type.
  // (For Asset and Expense accounts, debits are positive; for Liability and Income
  // accounts, credits are positive.)
  get_amount: function() {
    var amount
    var getter = function (type) {
      var reverse = type == 'debit' ? 'credit' : 'debit'
      var value = this[type] ? this[type] : -1 * this[reverse]
      return value || 0
    }.bind(this)
    switch (this.type) {
      case 'Asset': case 'Expense': amount = getter('debit'); break
      case 'Liability': case 'Income': amount = getter('credit'); break
      default: throw( new Register.Exceptions.LedgerRowException('amount', "No account type matches: #{type}", { type: this.type }))
    }
    return amount
  },

  // Returns either credit or negative debit, ignoring the account type, unlike get_amount().
  get_credit_or_debit: function() {
    return this.credit || -1 * this.debit || 0
  },

  // Returns either debit or negative credit, ignoring the account type, unlike get_amount().
  get_debit_or_credit: function() {
    return this.debit || -1 * this.credit || 0
  },

  get_detail: function() {
    return this.detail
  },

  set_detail: function(value) {
    this.detail = value
    return value
  },

  // True if the row type is PAYMENT_TYPE.
  is_payment: function() {
    return this.code_type == Register.LedgerRow.PAYMENT_TYPE
  },

  // True if the row type is PURCHASE_TYPE
  is_purchase: function() {
    return this.code_type == Register.LedgerRow.PURCHASE_TYPE
  },

  // Unless row is read_only, updates the given field with the requested value
  // through it's setter method, then fires 'update' callbacks.
  update: function(name, value) {
    if (this.read_only) { return false }
    var result = this["set_" + name](value)
    this.fire('update')
    return result
  },

  // Unless row is read_only, Fires 'destroy' callbacks and deletes the
  // instance.
  destroy: function() {
    if (this.read_only) { return false }
    this.fire('destroy')
    return true
  },

  // Serialize as an Object.
  serialize: function() {
    return {
      type: this.type,
      account_number: this.account_number,
      account_name: this.account_name,
      detail: this.get_detail(),
      register_code: this.register_code,
      debit: this.get_debit(),
      credit: this.get_credit(),
      code_label: this.get_label(),
      code_type: this.code_type,
    }
  },

  __set_amount: function(raw_amount, type) {
    if (this.read_only) {
      throw( new Register.Exceptions.LedgerRowException('__set_amount', "Attempted to set #{type} to #{amount} for a read only row.", { type: type, amount: raw_amount }))
    }
    var amount = this.parseMoney(raw_amount) 
    if (isNaN(amount)) {
      throw( new Register.Exceptions.LedgerRowException('__set_amount', "Attempted to set #{type} but amount #{amount} is not a number.", { type: type, amount: amount }))
    } else if (amount == 0) {
      throw( new Register.Exceptions.LedgerRowException('__set_amount', "Cannot set a LedgerRow amount to zero."))
    } else {
      amount = parseFloat(amount.toFixed(2)) // get a float fixed to 2 decimal places
    }

    var setter = function (amount, reverse) {
      if (amount < 0) {
        amount = -amount
        this[type] = undefined
        this[reverse] = amount
      } else {
        this[type] = amount
        this[reverse] = undefined
      }
      return amount
    }.bind(this)

    var result
    switch (type) {
      case 'credit':
        result = setter(amount, 'debit'); break
      case 'debit':
        result = setter(amount, 'credit'); break
      default: throw( new Register.Exceptions.LedgerRowException('__set_amount', "Invalid type: #{type}", { type: type }))
    }
    
    return result
  },
})
