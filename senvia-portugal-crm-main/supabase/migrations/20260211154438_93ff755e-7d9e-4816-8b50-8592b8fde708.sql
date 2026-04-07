
INSERT INTO public.organization_profiles (organization_id, name, base_role, is_default, data_scope, module_permissions)
SELECT id, 'CE', 'salesperson', false, 'team', '{
  "leads": {
    "subareas": {
      "kanban": { "view": true, "add": true, "edit": true, "delete": false, "assign": true },
      "export": { "export": true, "import": false }
    }
  },
  "clients": {
    "subareas": {
      "list": { "view": true, "add": true, "edit": true, "delete": false },
      "communications": { "view": true, "add": true },
      "cpes": { "view": true, "add": false, "edit": false, "delete": false }
    }
  },
  "proposals": {
    "subareas": {
      "proposals": { "view": true, "create": true, "edit": true, "delete": false, "send": true }
    }
  },
  "sales": {
    "subareas": {
      "sales": { "view": true, "create": true, "edit": true, "delete": false },
      "payments": { "view": true, "add": true }
    }
  },
  "finance": {
    "subareas": {
      "summary": { "view": true },
      "invoices": { "view": true, "issue": false, "cancel": false },
      "expenses": { "view": true, "add": false, "edit": false, "delete": false },
      "payments": { "view": true },
      "requests": { "view": true, "submit": false, "approve": false }
    }
  },
  "calendar": {
    "subareas": {
      "events": { "view": true, "create": true, "edit": true, "delete": false }
    }
  },
  "marketing": {
    "subareas": {
      "templates": { "view": false, "create": false, "edit": false, "delete": false, "send": false }
    }
  },
  "ecommerce": {
    "subareas": {
      "products": { "view": false, "create": false, "edit": false, "delete": false },
      "orders": { "view": false, "edit": false },
      "customers": { "view": false, "create": false, "edit": false },
      "inventory": { "view": false, "edit": false },
      "discounts": { "view": false, "create": false, "edit": false, "delete": false }
    }
  },
  "settings": {
    "subareas": {
      "general": { "view": false, "edit": false },
      "team": { "view": false, "manage": false },
      "pipeline": { "view": false, "edit": false },
      "profiles": { "view": false, "manage": false },
      "modules": { "view": false, "edit": false }
    }
  }
}'::jsonb
FROM public.organizations;
