// This file is part of register.js.  Copyright 2011 Joshua Partlow.  This program is free software, licensed under the terms of the GNU General Public License.  Please see the LICENSE file in this distribution for more information, or see http://www.gnu.org/copyleft/gpl.html.

/////////////////////
/* Register.UI     */
/////////////////////

// Provides the HTML and events for user interaction with the register.
Register.UI = function(register, template) {
  this.register = register
  this.ledger = register.ledger
  this.purchase_codes = register.purchase_codes
  this.payment_codes = register.payment_codes
  this.credit_codes = register.credit_codes
  this.adjustment_codes = register.adjustment_codes
  this.template_source = template || ''
}
Register.UI.inherits(Register.Core)
// Constants
Register.UI.AMOUNT_CREDITED_ID = 'amount-credited'
Register.UI.AMOUNT_CREDITED_ROW_SELECTOR = '.amount-credited.row'
Register.UI.AMOUNT_TENDERED_ID = 'amount-tendered'
Register.UI.AMOUNT_TENDERED_ROW_SELECTOR = '.amount-tendered.row'
Register.UI.CANCEL_CONTROL_SELECTOR = '.cancel-control a'
Register.UI.CC_INPUT = 'cc-input-popup'
Register.UI.CC_INPUT_AREA = 'cc-input'
Register.UI.CHANGE_DUE_ID = 'change-due'
Register.UI.CREDIT_CARD_TRACK_ONE_ID = 'payment_credit_card_track_one'
Register.UI.CREDIT_CARD_TRACK_TWO_ID = 'payment_credit_card_track_two'
Register.UI.ERRORS_SELECTOR = '.errorExplanation'
Register.UI.FORM_ID = 'payment-form'
Register.UI.KEY_PERCENT_SIGN = 37
Register.UI.LEDGER_ENTRIES_ID = 'ledger-entries'
Register.UI.LEDGER_ROW_TEMPLATE_ID = 'ledger-entry-row-template'
Register.UI.PAYMENT_CODES_SELECT_ID = 'payment-type'
Register.UI.PAYMENT_FIELDS_ID = 'payment-fields'
Register.UI.PURCHASE_AMOUNT_INPUT_ID = 'purchase-amount'
Register.UI.PURCHASE_CODES_SELECT_ID = 'purchase-code'
Register.UI.PURCHASE_CODES_SELECT_BLANK_VALUE = '*Blank*'
Register.UI.SUBMISSION_CONTROLS_ID = 'submission-controls'
Register.UI.TOTAL_COST_ID = 'total-cost'
// Methods
Object.extend(Register.UI.prototype, {

  // Call to prepare UI for interaction with Ledger and user.
  initialize: function() {
    var wrapper = new Element('div').update(this.template_source)
    this.register_template = wrapper.childElements().first()
    this.rows = $A()
    if (this.register_template) {
      // isolate ledger_row_template and set the root register element
      this.ledger_row_template = this.locate(Register.UI.LEDGER_ROW_TEMPLATE_ID, this.register_template).remove()
      this.ledger_row_template.id = null // don't want to propogate the template id in new rows...
      this.root = this.register_template.cloneNode(true)
      // isolate other important elements
      this.form = this.locate(Register.UI.FORM_ID)
      this.errors_div = this.locate(Register.UI.ERRORS_SELECTOR)
      this.errors_div.hide()
      this.ledger_entries = this.locate(Register.UI.LEDGER_ENTRIES_ID)
      this.purchase_amount_input = this.locate(Register.UI.PURCHASE_AMOUNT_INPUT_ID)
      this.payment_fields = this.locate(Register.UI.PAYMENT_FIELDS_ID)
      this.total = this.locate(Register.UI.TOTAL_COST_ID)
      this.tendered = this.locate(Register.UI.AMOUNT_TENDERED_ID)
      this.tendered_row = this.locate(Register.UI.AMOUNT_TENDERED_ROW_SELECTOR)
      this.credited = this.locate(Register.UI.AMOUNT_CREDITED_ID)
      this.credited_row = this.locate(Register.UI.AMOUNT_CREDITED_ROW_SELECTOR)
      this.change = this.locate(Register.UI.CHANGE_DUE_ID)
      this.submission_controls = this.locate(Register.UI.SUBMISSION_CONTROLS_ID)
      this.cancel_control = this.locate(Register.UI.CANCEL_CONTROL_SELECTOR)
      this.credit_card_track_one = this.locate(Register.UI.CREDIT_CARD_TRACK_ONE_ID)
      this.credit_card_track_two = this.locate(Register.UI.CREDIT_CARD_TRACK_TWO_ID)
      this.credit_card_input_popup = this.locate(Register.UI.CC_INPUT)
      this.credit_card_input = this.locate(Register.UI.CC_INPUT_AREA)
      // populate select controls with codes
      this.purchase_codes_select = this.locate(Register.UI.PURCHASE_CODES_SELECT_ID)
      this.update_from_array(
        this.purchase_codes_select,
        this.make_options(
          this.purchase_codes, 
          'id', 
          function(o) { return o.code + " (" + o.label.truncate(35) + ")" }, 
          { value: Register.UI.PURCHASE_CODES_SELECT_BLANK_VALUE, label: '- Select a code -' }
        ),
        true
      )
      this.payment_codes_select = this.locate(Register.UI.PAYMENT_CODES_SELECT_ID)
      this.update_from_array(
        this.payment_codes_select, 
        this.make_options({
            Payments: this.payment_codes,
            Credits: this.credit_codes,
            Adjustments: this.adjustment_codes,
          },
          'id',
          'label'
        )
      )
      // set up existing payment/ledger information
      this.set_payment_fields_from_payment()
      this.set_ledger_history()
      // initialize callback functions in the root register so that it will respond to
      // user actions
      this.initialize_register_callbacks()
      // set the register's title header
      this.set_title()
      // ensure UI is updated when ledger changes.
      this.ledger.add_listener('update', this.update.bind(this))
      // set visible payment fields
      // set ledger payment code to first available
      this.handle_payment_code_select()
      this.cc_hide_and_disable_input()
    }
    return this
  },

  // Reset total amounts based on current ledger.
  update: function() {
    this.total.update(this.monetize_from_cents(this.ledger.get_purchase_total(), true))
    this.tendered.ledger_value = this.ledger.get_tendered_total()
    this.tendered.value = (this.monetize_from_cents(this.tendered.ledger_value, true))
    this.credited.ledger_value = this.ledger.get_credited_total()
    this.credited.update(this.monetize_from_cents(this.credited.ledger_value, true))
    this.change.update(this.monetize_from_cents(this.ledger.get_change_total(), true))
    this.tendered.ledger_value == 0 ? this.tendered_row.hide() : this.tendered_row.show()
    this.credited.ledger_value == 0 ? this.credited_row.hide() : this.credited_row.show()
  },

  display_errors: function() {
    this.errors_div.update('')
    var payment_error = this.register.payment_error
    var validation_errors = this.register.validation_errors
    if (payment_error || validation_errors) {
      this.errors_div.insert(new Element('h2').update('Payment Errors'))
      if (payment_error) {
        this.errors_div.insert(new Element('p').update(payment_error)) 
      }
      if (validation_errors) {
        var ul = new Element('ul')
        $A(validation_errors.errors).each(function(err) {
          ul.insert(new Element('li').update(err))
        })
        this.errors_div.insert(ul)
        this.payment_fields.select('.fieldWithError').invoke('removeClassName', '.fieldWithError')
        $A(validation_errors.on).each(function(attr) {
          var field = this.find_payment_field(attr)
          if (field) { field.addClassName('fieldWithError') }
        }, this)
      }
      this.errors_div.show()
    }
  },

  // Returns an Array of the enabled payment fields (including hidden inputs).
  // Returns all payment fields if include_disabled is true.
  get_payment_fields: function(include_disabled) {
    if (typeof this.all_payment_fields == 'undefined') {
      this.all_payment_fields = this.payment_fields.select('input','select','textarea')
    }
    return include_disabled ?
      this.all_payment_fields :
      this.all_payment_fields.findAll(function(e) {
        return !e.disabled
      })
  },

  // Returns an Array of all visible, and enabled payment fields. 
  get_enabled_visible_payment_fields: function() {
    return this.get_payment_fields(false).reject(function(e) {
      return !e.visible() || e.type == 'hidden'
    })
  },

  // Find an enabled payment field by field.id.  (Will prefix 'payment_' if id
  // does not already include it.)
  // Set include_disabled to true to find any payment field by id.
  find_payment_field: function(id, include_disabled) {
  //  id = id.match(/^payment_/) ? id : 'payment_' + id
    return this.get_payment_fields(include_disabled).detect(function(f) { return f.id == id || f.id == 'payment_' + id })
  },

  // Returns an Array of the enabled submission controls.
  get_submission_controls: function(all) {
    return this.submission_controls.select('input').findAll(function(e) {
      return all ? true : !e.disabled
    })
  },

  // Find an enabled submission control by field.id.  (Will prefix
  // 'payment_submit_' if id does not include it.)
  find_submission_control: function(id) {
    id = id.match(/^payment_submit_/) ? id : 'payment_submit_' + id
    return this.get_submission_controls().detect(function(f) { return f.id == id })
  },

  // Returns the payment code object associated with the currently selected payment type.
  get_payment_code: function() {
    return this.register.find_code(this.payment_codes_select.value)
  },

  // Sets the value of the payment_codes_select control if given 
  // a Register.PaymentCode.
  set_payment_code: function(code) {
    return this.payment_codes_select.setValue(code.id)
  },

  // Returns the current payment_type string value as determined by the setting
  // of the payment-type select control.
  get_payment_type: function() {
    return this.get_payment_code().payment_type
  },

  // Hides or shows and enables or disables payment fields based on the
  // currently selected payment type.
  //
  // If this register is reversing an existing payment, all fields except
  // user, date and notes will be disabled.
  setup_payment_type_fields: function() {
    Register.UI.setup_payment_fields_by_type_for(this.root, this.get_payment_type())
    if (!this.is_new()) {
      this.get_payment_fields().each(function(field) {
        if (!field.id.match(/payment_note/)) {
          field.disable()
        }
      })
    }
  },

  // Sets payment field values from register.payment.
  set_payment_fields_from_payment: function() {
    var payment = this.register.payment
    payment.fields.each(function(field_name) {
      var input = this.find_payment_field(field_name, true)
      if (input) {
        // Do not set user_id, date from previous payment 
        if (this.is_new() || !input.id.match('payment_(date|user_id)')) {
          input.setValue(payment[field_name])
        }
      }
    }, this)
    if (!this.is_new()) {
      // payment type needs to be set by code.id
      this.set_payment_code(payment.code())
    }
  },

  // Creates read only ledger row history from any existing ledger purchase or change rows
  // (if we are updating a previous payment).  Also disables amount tendered input if
  // we are updating a previous payment.
  set_ledger_history: function() {
    if (!this.is_new()) {
      this.ledger.get_rows('old').each(function(row) {
        if (!row.is_payment()) {
          this.add_ledger_history_row(row)
        }
      }, this)
      this.tendered.disabled = true
    }
  },

  // True if we are creating a new payment.
  is_new: function() {
    return this.register.is_new()
  },

  set_title: function() {
    var title = this.is_new() ? "New Payment" : "Payment #" + this.register.id()
    this.root.down('.title').update(title)
    return title 
  },

  // Generate and return a set of select options.  One option is generated for
  // each object in the passed array.  Or if an object is given, optgroups 
  // are generated for each property, and the property's array value is converted
  // to options.
  //
  // * array_or_object: if given an array, converts to options.  If given an object,
  //   converts each property into an optgroup of options.
  // * label_method: may be passed a function which in turn will be passed each
  //   option in the array (for generating custom labels)
  make_options: function(array_or_object, value_method, label_method, default_option_values) {
    var default_option, options
    if (default_option_values) {
      default_option = new Element('option', { value: default_option_values.value }).update(default_option_values.label)
    } 
    if (array_or_object instanceof Array) {
      options = $A(array_or_object).map(function(o) {
        var value = Object.__send(o, value_method)
        var label = (typeof label_method == 'function') ?
          label_method(o) :
          Object.__send(o, label_method)
        return new Element('option', { value: value }).update(label)
      })
    } else {
      options = $A([])
      var opt_group
      for (opt_group in array_or_object) {
        options.push(
          this.update_from_array(
            new Element('optgroup', { label: opt_group }),
            this.make_options(array_or_object[opt_group], value_method, label_method),
            true
          )
        )
      }
    }
    if (default_option) { options.unshift(default_option) }
    return options
  },

  // A read-only ledger when updating a payment.
  add_ledger_history_row: function(ledger_row) {
    return this._add_ledger_row(ledger_row)
  },

  add_ledger_row: function(code_id, amount) {
    var cents = this.convert_to_cents(amount)
    return this._add_ledger_row(this.register.ledger.add_purchase(code_id, cents))
  },

  _add_ledger_row: function(ledger_row) {
    var ui_row = (new Register.UI.Row(this, ledger_row))
    this.rows.push(ui_row)
    this.ledger_entries.insert(ui_row.root)
    return ui_row
  },

  remove_ledger_row: function(ui_row) {
    this.rows.remove(this.rows.indexOf(ui_row))
  },

  // Clear purchase amount, set purchase codes to default and move focus back to
  // purchase amount.
  reset_ledger_entry_input_controls: function() {
    this.purchase_amount_input.value = null 
    this.purchase_codes_select.value = Register.UI.PURCHASE_CODES_SELECT_BLANK_VALUE
    this.purchase_amount_input.activate()
  },

  serialize: function() {
    var serialized = {}
    this.get_payment_fields().inject(serialized, function(object,field) {
      object[field.name] = field.value
      return object
    })
    serialized['payment[type]'] = this.get_payment_type()
    serialized[this.successful_submitter.name] = this.successful_submitter.value
    return serialized
  },

  validate: function() {
    var valid = this.ledger.validate()
    this.errors = this.ledger.errors.clone()
    required = this.get_enabled_visible_payment_fields().select(function(e) {
      return e.hasClassName('required') && !e.present()
    })
    if (required.size() > 0) {
      valid = false
      this.errors.push('required fields have not been entered: ' + required.map(function(e) { return e.id.replace(/payment_/,'') }))
    }
    this.rows.each(function(row) {
      if (!row.validate()) {
        valid = false
        this.errors.push(row.errors)
      }
    }, this)
    this.errors = this.errors.flatten().uniq()
    return valid
  },

  // Callback for user choosing an entry in the purchase code select.
  // XXX Is there a good reason to add callbacks around the UI events?  Rather than
  // callbacks around core register events like totals updates?
  handle_purchase_code_select: function(event) {
    if (this.before_purchase_code_select && !this.before_purchase_code_select()) {
      event.stop()
    } else {
      var amount = this.parseMoney(this.purchase_amount_input.value)
      var code_id = this.purchase_codes_select.value
      if (isNaN(amount)) {
        this.alert_user("Please enter an amount")
      } else if (isNaN(code_id)) {
        // do not attempt to add -- default code row selected.
      } else {
        this.add_ledger_row(code_id, amount)
        if (this.after_purchase_code_select) { this.after_purchase_code_select() }
      }
      this.reset_ledger_entry_input_controls()
    }
  },

  // If we have not yet begun to process a credit card, and we detect a '%'
  // while payment type is for a credit card, ensure that focus is on 
  // the purchase amount input control which has a handler for parsing credit
  // tracks. 
  handle_register_card_swipe: function(event) {
    if (!this.processing_a_credit_card && event.charCode == Register.UI.KEY_PERCENT_SIGN) {
      var payment_code = this.get_payment_code()
      if (payment_code.is_credit_card()) {
        event.stop()
        this.processing_a_credit_card = true
        this.credit_card_input.enable()
        this.credit_card_input.value = '%'
        this.credit_card_input_popup.show()
        this.credit_card_input.focus()
      }
    }
  },

  // If we are processing a credit card swipe, parse content for valid credit card
  // track data and place into the payment fields if received.
  handle_credit_card_input: function(event) {
    if (this.processing_a_credit_card) {
      try {
        var parser = new CreditCardTrackData(this.credit_card_input.value)
        if (parser.is_minimally_valid()) {
          this.credit_card_track_one.value = parser.track1.raw
          this.credit_card_track_two.value = parser.track2.raw
          this.find_payment_field('credit_card_number').value = parser.number
          this.find_payment_field('credit_card_month').value = parser.month()
          this.find_payment_field('credit_card_year').value = parser.year()
          this.find_payment_field('credit_card_first_name').value = parser.first_name
          this.find_payment_field('credit_card_last_name').value = parser.last_name
          this.cc_hide_moto_fields()
        }
      } catch(err) {
        if (typeof(err) == 'string' && err.match(/^CCTD/)) {
          this.alert_user('Unable to parse credit card, please try swiping it again')
        } else {
          throw(err)
        }
      } finally {
        this.processing_a_credit_card = false
        this.cc_hide_and_disable_input()
      }
    }
  },

  // Callback for user changing the payment type.
  handle_payment_code_select: function(event) {
    this.setup_payment_type_fields()
    this.ledger.set_payment_code(this.get_payment_code())
  },

  // Callback for user changing the amount tendered.
  handle_amount_tendered_input: function(event) {
    this.ledger.set_amount_tendered(this.convert_to_cents(this.tendered.value))
  },

  // Callback for user clicking the cancel control.
  handle_cancel_control_click: function(event) {
    return this.register.cancel(event)
  },

  handle_submit_control_clicked: function(event) {
    this.successful_submitter = event.findElement()
    return true
  },

  handle_form_submit: function(event) {
    event.stop()
    if (!this.validate()) {
      var message = "Please correct the following:\n"
      this.errors.each(function(m) {
        message = message + " * " + m + "\n"
      })
      this.alert_user(message)
    } else {
      // double-check authorization or record calls for credit cards.
      if (this.successful_submitter.value == 'Authorize') {
        if (!confirm("Authorizing will put a temporary hold in the amount of " + this.monetize_from_cents(this.ledger.get_amount_tendered_or_credited(), true) + " on the guest's credit card.  No funds will be transferred.  You may capture the funds later in a separate transaction.  Continue?")) {
          return false
        }
      }
      if (this.successful_submitter.value == 'Record' && this.get_payment_code().is_credit_card()) {
        if (!confirm("Recording this credit card transaction will not capture any funds.  This should only be used to record a credit card transaction made through some other agency.  Continue?")) {
          return false
        }
      }
      return this.register.submit(event)
    }
    return false
  },

  // Initializes callback functions on user controls in the current root register ui.
  // * purchase-code select - on change create a ledger row, update totals
  // * payment-type select - on change update register payment state and hide/show
  //   correct payment fields.
  // * amount-tendered - on change parse possible credit card track data 
  // * card swipe - key logger to detect and handle card swipe
  // * tabbing - keep tab cycle within register
  // * submission - validate before submit
  initialize_register_callbacks: function() {
    this.initialize_purchase_code_controls()
    this.initialize_payment_code_controls()     
    this.initialize_amount_tendered_control()
    this.initialize_submission_controls()
    if (this.is_new()) {
      this.initialize_register_card_swipe()
    }
    this.initialize_tabbing_controls()
  },

  // Attaches onchange callback to UI amount-tendered input to update the ledger.
  initialize_amount_tendered_control: function() {
    this.tendered.observe('change', this.handle_amount_tendered_input.bind(this))
  },

  // Attaches onchange callback to UI purchase-code select to add new ledger rows.
  initialize_purchase_code_controls: function() {
    this.purchase_codes_select.observe('change', this.handle_purchase_code_select.bind(this))
  },

  // Attaches onchange callback to UI payment-type select to change the payment type and
  // show/hide associated fields.
  initialize_payment_code_controls: function() {
    this.payment_codes_select.observe('change', this.handle_payment_code_select.bind(this))
  },
  
  // Attaches onsubmit callback to UI submission controls, and an onclick callback
  // for cancel control.
  initialize_submission_controls: function() {
    this.cancel_control.observe('click', this.handle_cancel_control_click.bind(this))
    this.form.observe('submit', this.handle_form_submit.bind(this))
    this.get_submission_controls(true).each(function(submit) {
      submit.observe('click', this.handle_submit_control_clicked.bind(this)) 
    }, this)
    this.form.observe('keypress', this.handle_enter_key_submit.bind(this))
  },
  
  initialize_register_card_swipe: function() {
    this.processing_a_credit_card = false
    this.form.observe('keypress', this.handle_register_card_swipe.bind(this))
    this.credit_card_input.observe('change', this.handle_credit_card_input.bind(this))
  },

  cc_hide_and_disable_input: function() {
    this.credit_card_input_popup.hide()
    this.credit_card_input.value = ''
    this.credit_card_input.disable()
    return this.credit_card_input_popup
  },

  // Hide credit card fields only associated with moto transactions.
  // XXX Clean up hard coded selectors.
  cc_hide_moto_fields: function() {
    $('payment_credit_card_verification_value').hide()
    $$('label[for=payment_credit_card_verification_value]').first().hide()
    $('payment_credit_card_billing_address').hide()
    $$('label[for=payment_credit_card_billing_address]').first().hide()
    $('payment_credit_card_zip_code').hide()
    $$('label[for=payment_credit_card_zip_code]').first().hide()
  },

  // With multiple submit buttons, Firefox fails to submit after hitting enter
  // in an input control if the first submit button is disabled.  So if we have
  // three submit buttons and the first two are disabled, we can no longer
  // submit by hitting the enter key in an input control.  So we add keypress
  // observers to the input controls to make up for this.
  handle_enter_key_submit: function(event) {
    var current_input = event.findElement()
    if (event.keyCode == Event.KEY_RETURN && current_input.type == 'text') {
      event.stop()
      if (this.processing_a_credit_card) {
        this.get_enabled_visible_payment_fields().first().focus()
      } else if (current_input == this.purchase_amount_input && current_input.present()) {
        this.purchase_codes_select.focus() 
      } else if (current_input == this.purchase_amount_input || this.get_payment_fields().include(current_input)) {
        this.get_submission_controls().first().click()
      }
    }
  },
  
  // Ensures that tabbing/shift-tabbing circles only within register controls.
  initialize_tabbing_controls: function() {
    // register submit catches tab and focuses on amount-input for a closed tabbing loop
    this.get_submission_controls().last().observe('keypress', function(event) {
      if (event.keyCode == Event.KEY_TAB && !event.shiftKey) {
        event.stop()
        this.purchase_amount_input.activate()
      }
    }.bind(this))
    // register amount-input catches shift-tab and focuses back to payment submit
    this.purchase_amount_input.observe('keypress', function(event) {
      if (event.keyCode == Event.KEY_TAB && event.shiftKey) {
        event.stop()
        this.get_submission_controls().last().focus()
      }
    }.bind(this))
    // register payment_type catches tab, allows onChange to fire to ensure that
    // fields are hidden/shown based on payment type, and then moves to the next
    // input that would be available by payment type unless that field is the
    // payment type selector itself or the focus is currently on amount-tendered
    this.payment_codes_select.observe('keypress', function(event) {
      if (event.keyCode == Event.KEY_TAB && !event.shiftKey) {
        var payment_codes_select = event.findElement()
        // Allow a moment for the onChange event to complete updates to the 
        // enabled/disabled fields
        setTimeout(function() { 
          next_payment_field = this.get_enabled_visible_payment_fields().first()
          if ((payment_codes_select != next_payment_field) &&
              (this.tendered != document.activeElement)) {
            next_payment_field.focus()
          }
        }.bind(this), 100)
      } 
    }.bind(this))
  },

})
// Type Functions

// Utility function hides or shows and enables or disables payment fields in the passed
// element based on the given payment type.
Register.UI.setup_payment_fields_by_type_for = function(payment_section, payment_type) {
  payment_section.select('.show-by-type').each(function(e) {
    e.hide()
    e.select('input','select','textarea').invoke('disable')
  })
  payment_section.select('.show-by-type.' + payment_type).each(function(e) {
    e.select('input','select','textarea').invoke('enable')
    e.show()
  })
}


// Provides the HTML and events for user interaction with a ledger row in the register.
Register.UI.Row = function(ui, ledger_row) {
  this.ui = ui
  this.ledger_row = ledger_row
  this.root = this.ui.ledger_row_template.cloneNode(true)
  this.initialize()
}
Register.UI.Row.inherits(Register.Core)
// Constants
Register.UI.Row.LABEL_SELECTOR = '.label'
Register.UI.Row.DEBIT_SELECTOR = '.debit-row-control'
Register.UI.Row.CREDIT_SELECTOR = '.credit-row-control'
Register.UI.Row.DETAIL_SELECTOR = '.detail-row-control'
Register.UI.Row.REMOVE_SELECTOR = '.remove-row-control'
// Methods
Object.extend(Register.UI.Row.prototype, {
  initialize: function() {
    this.label = this.locate(Register.UI.Row.LABEL_SELECTOR)
    this.initialize_input('debit')
    this.initialize_input('credit')
    this.initialize_input('detail')
    this.initialize_input('remove')
    this.ledger_row.add_listener('update', this.update.bind(this))
    this.ledger_row.add_listener('destroy', this.destroy.bind(this))
    this.initialize_callbacks()
    this.update()
  },

  // Initializes the specified input control with meta data and helper functions for
  // callbacks.
  initialize_input: function(name) {
    var selector = Register.UI.Row[name.toUpperCase() + "_SELECTOR"]
    var input = this[name] = this.locate(selector)
    input.ui_row = this
    input.ledger_field_name = name
    if (name == 'credit' || name == 'debit') {
      input.is_a_credit_or_debit_field = true
    }

    // If row is not new, inputs should be disabled.
    // A debit or credit field should only enable if the row is a debit or credit.
    input.allow_enable = function() {
      var ledger_row = this.ui_row.ledger_row
      var enable_allowed = true
      if (!ledger_row.is_new() ||
         (this.is_a_credit_or_debit_field &&
          !ledger_row["is_" + this.ledger_field_name]())) {
        enable_allowed = false
      }
      return enable_allowed
    }

    input.reset_enable = function() {
      this.allow_enable() ?
        this.enable() :
        this.disable()
      return input
    }

    return input 
  },

  // Set the row's html field values from the internal ledger_row values.
  update: function() {
    this.label.update(this.ledger_row.get_label())
    this.__set('debit', true)
    this.__set('credit', true)
    this.__set('detail')
    this.reset_enable()
    return this
  },

  // Set the given input from the internal ledger_row state.
  // Null or undefined values will be set as the empty string.
  // Non-null numbers will be monetized if monetize_value is set true.
  __set: function(name, monetize_value) {
    var value = this.ledger_row["get_" + name]()
    value = value || ''
    this[name].value = monetize_value ? this.monetize_from_cents(value) : value
    return this
  },

  set_detail: function(value) {
    return this.detail.value = value
  },

  // Validate the row.  Currently tests whether detail field is required.
  // Returns true or false depending on whether the row has validation errors and
  // sets an array this.errors with error messages.
  validate: function() {
    this.errors = $A([])
    // Check for required detail input.
    if (this.ledger_row.require_detail && !this.detail.present()) {
      this.errors.push("Detail is required for a row entry of type '" + this.ledger_row.code_label + "'.")
    }
    return this.errors.length == 0
  },

  // Returns an Array of the row's form controls.
  get_controls: function() {
    return this.root.select('input','select','textarea')
  },

  // Reset the row's form controls to be either enabled or disabled based on state.
  // (Whether they are read-only or empty debit or credit inputs)
  reset_enable: function() {
    this.get_controls().invoke('reset_enable')
  },

  // Enable all of the row's form controls.
  enable: function() {
    this.get_controls().invoke('enable')
  },

  // Disable all of the row's form controls.
  disable: function() {
    this.get_controls().invoke('disable')
  },

  // True if this row reflects a newly created ledger row that may be edited or
  // destroyed.
  is_new: function() {
    return this.ledger_row.is_new()
  },

  // Setup the event callbacks for the row's controls.
  // * ledger row value - on change flip credit/debit if switch from positive to negative,
  //   delete if zero, update totals
  // * ledger row remove - on click remove ledger row, update totals
  initialize_callbacks: function() {
    this.remove.observe('click', this.handle_remove.bind(this))
    $A(['credit', 'debit', 'detail']).each(function(control) {
      this[control].observe('change', this.handle_update)
    }, this)
  },

  handle_remove: function(event) {
    this.ledger_row.destroy()
  },

  // Not bound to UI.Row because we want the Input.value and this
  // handle is generic to all the text Input elements in the row.
  handle_update: function(event) {
    var ui_row = this.ui_row
    var ledger_row = ui_row.ledger_row
    var row_value = this.value
    if (this.is_a_credit_or_debit_field) {
      var numeric_value = ui_row.parseMoney(this.value)
      if (this.value.empty() || numeric_value == 0) {
        return ledger_row.destroy()
      } else if (isNaN(numeric_value)) {
        ui_row.alert_user("Please enter a number")
        ui_row.__set(this.ledger_field_name, true)
        return false
      }
      row_value = ui_row.convert_to_cents(numeric_value)
    }
    return ledger_row.update(this.ledger_field_name, row_value)
  },

  // Remove the row from the ledger and destroy it.
  destroy: function() {
    this.root.remove() // remove from Document
    this.ui.remove_ledger_row(this)
    return true
  },
})
