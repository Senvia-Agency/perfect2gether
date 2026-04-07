ALTER TABLE invoices
  DROP CONSTRAINT invoices_payment_id_fkey;

ALTER TABLE invoices
  ADD CONSTRAINT invoices_payment_id_fkey
  FOREIGN KEY (payment_id) REFERENCES sale_payments(id) ON DELETE SET NULL;