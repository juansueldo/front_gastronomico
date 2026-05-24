export {
  createCustomer,
  deleteCustomer,
  findCustomerByPhone,
  getCustomer,
  listCustomerOrders,
  listCustomers,
  updateCustomer,
} from './services/customers.service';
export type {
  CreateCustomerRequest,
  Customer,
  CustomerListResult,
  CustomerLookupResult,
  ListCustomersParams,
  UpdateCustomerRequest,
} from './services/customers.service';
