export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activation_objectives: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          month: string
          organization_id: string
          period_type: string
          proposal_type: string
          target_quantity: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          month: string
          organization_id: string
          period_type: string
          proposal_type: string
          target_quantity?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          month?: string
          organization_id?: string
          period_type?: string
          proposal_type?: string
          target_quantity?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activation_objectives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_announcements: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          published_at: string
          title: string
          version: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          published_at?: string
          title: string
          version?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          published_at?: string
          title?: string
          version?: string | null
        }
        Relationships: []
      }
      automation_queue: {
        Row: {
          automation_id: string
          created_at: string
          id: string
          organization_id: string
          recipient_email: string
          recipient_name: string | null
          scheduled_for: string
          status: string
          template_id: string
          variables: Json | null
        }
        Insert: {
          automation_id: string
          created_at?: string
          id?: string
          organization_id: string
          recipient_email: string
          recipient_name?: string | null
          scheduled_for: string
          status?: string
          template_id: string
          variables?: Json | null
        }
        Update: {
          automation_id?: string
          created_at?: string
          id?: string
          organization_id?: string
          recipient_email?: string
          recipient_name?: string | null
          scheduled_for?: string
          status?: string
          template_id?: string
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_queue_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "email_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_account_transactions: {
        Row: {
          amount: number
          bank_account_id: string
          created_at: string
          description: string | null
          id: string
          organization_id: string
          reference_id: string | null
          reference_type: string | null
          running_balance: number
          transaction_date: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id: string
          created_at?: string
          description?: string | null
          id?: string
          organization_id: string
          reference_id?: string | null
          reference_type?: string | null
          running_balance?: number
          transaction_date?: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          reference_id?: string | null
          reference_type?: string | null
          running_balance?: number
          transaction_date?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_account_transactions_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_account_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          bank_name: string | null
          created_at: string
          holder_name: string | null
          iban: string | null
          id: string
          initial_balance: number
          is_active: boolean
          is_default: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          bank_name?: string | null
          created_at?: string
          holder_name?: string | null
          iban?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          is_default?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          bank_name?: string | null
          created_at?: string
          holder_name?: string | null
          iban?: string | null
          id?: string
          initial_balance?: number
          is_active?: boolean
          is_default?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          client_id: string | null
          created_at: string | null
          description: string | null
          end_time: string | null
          event_type: string
          id: string
          lead_id: string | null
          meeting_link: string | null
          organization_id: string
          reminder_minutes: number | null
          reminder_sent: boolean | null
          start_time: string
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          event_type?: string
          id?: string
          lead_id?: string | null
          meeting_link?: string | null
          organization_id: string
          reminder_minutes?: number | null
          reminder_sent?: boolean | null
          start_time: string
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          client_id?: string | null
          created_at?: string | null
          description?: string | null
          end_time?: string | null
          event_type?: string
          id?: string
          lead_id?: string | null
          meeting_link?: string | null
          organization_id?: string
          reminder_minutes?: number | null
          reminder_sent?: boolean | null
          start_time?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      client_communications: {
        Row: {
          client_id: string
          content: string | null
          created_at: string | null
          created_by: string | null
          direction: string | null
          duration_seconds: number | null
          id: string
          occurred_at: string
          organization_id: string
          subject: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          client_id: string
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          direction?: string | null
          duration_seconds?: number | null
          id?: string
          occurred_at?: string
          organization_id: string
          subject?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          client_id?: string
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          direction?: string | null
          duration_seconds?: number | null
          id?: string
          occurred_at?: string
          organization_id?: string
          subject?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      client_list_members: {
        Row: {
          added_at: string
          client_id: string
          id: string
          list_id: string
        }
        Insert: {
          added_at?: string
          client_id: string
          id?: string
          list_id: string
        }
        Update: {
          added_at?: string
          client_id?: string
          id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_list_members_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "client_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      client_lists: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          filter_criteria: Json | null
          id: string
          is_dynamic: boolean | null
          is_system: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter_criteria?: Json | null
          id?: string
          is_dynamic?: boolean | null
          is_system?: boolean
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter_criteria?: Json | null
          id?: string
          is_dynamic?: boolean | null
          is_system?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_lists_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_chargeback_imports: {
        Row: {
          chargeback_count: number
          cpe_column_name: string
          created_at: string
          file_name: string
          id: string
          imported_by: string
          matched_rows: number
          organization_id: string
          reference_month: string | null
          total_chargeback_amount: number
          total_rows: number
          unmatched_rows: number
        }
        Insert: {
          chargeback_count?: number
          cpe_column_name: string
          created_at?: string
          file_name: string
          id?: string
          imported_by: string
          matched_rows?: number
          organization_id: string
          reference_month?: string | null
          total_chargeback_amount?: number
          total_rows?: number
          unmatched_rows?: number
        }
        Update: {
          chargeback_count?: number
          cpe_column_name?: string
          created_at?: string
          file_name?: string
          id?: string
          imported_by?: string
          matched_rows?: number
          organization_id?: string
          reference_month?: string | null
          total_chargeback_amount?: number
          total_rows?: number
          unmatched_rows?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_chargeback_imports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_chargeback_items: {
        Row: {
          chargeback_amount: number
          cpe: string
          created_at: string
          id: string
          import_id: string
          matched: boolean
          matched_proposal_cpe_id: string | null
          matched_proposal_id: string | null
          matched_sale_id: string | null
          matched_user_id: string | null
          normalized_cpe: string | null
          organization_id: string
          raw_row: Json
          row_index: number
          unmatched_reason: string | null
        }
        Insert: {
          chargeback_amount?: number
          cpe: string
          created_at?: string
          id?: string
          import_id: string
          matched?: boolean
          matched_proposal_cpe_id?: string | null
          matched_proposal_id?: string | null
          matched_sale_id?: string | null
          matched_user_id?: string | null
          normalized_cpe?: string | null
          organization_id: string
          raw_row?: Json
          row_index: number
          unmatched_reason?: string | null
        }
        Update: {
          chargeback_amount?: number
          cpe?: string
          created_at?: string
          id?: string
          import_id?: string
          matched?: boolean
          matched_proposal_cpe_id?: string | null
          matched_proposal_id?: string | null
          matched_sale_id?: string | null
          matched_user_id?: string | null
          normalized_cpe?: string | null
          organization_id?: string
          raw_row?: Json
          row_index?: number
          unmatched_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_chargeback_items_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "commission_chargeback_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_chargeback_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_closing_items: {
        Row: {
          closing_id: string
          created_at: string
          id: string
          items_detail: Json
          organization_id: string
          total_commission: number
          total_consumo_mwh: number
          user_id: string
          volume_tier: string
        }
        Insert: {
          closing_id: string
          created_at?: string
          id?: string
          items_detail?: Json
          organization_id: string
          total_commission?: number
          total_consumo_mwh?: number
          user_id: string
          volume_tier: string
        }
        Update: {
          closing_id?: string
          created_at?: string
          id?: string
          items_detail?: Json
          organization_id?: string
          total_commission?: number
          total_consumo_mwh?: number
          user_id?: string
          volume_tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_closing_items_closing_id_fkey"
            columns: ["closing_id"]
            isOneToOne: false
            referencedRelation: "commission_closings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_closing_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_closings: {
        Row: {
          closed_at: string
          closed_by: string
          created_at: string
          id: string
          month: string
          notes: string | null
          organization_id: string
          total_commission: number
        }
        Insert: {
          closed_at?: string
          closed_by: string
          created_at?: string
          id?: string
          month: string
          notes?: string | null
          organization_id: string
          total_commission?: number
        }
        Update: {
          closed_at?: string
          closed_by?: string
          created_at?: string
          id?: string
          month?: string
          notes?: string | null
          organization_id?: string
          total_commission?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_closings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      commitment_lines: {
        Row: {
          comissao: number
          commitment_id: string
          created_at: string
          energia_mwh: number
          id: string
          nif: string
          notes: string | null
          proposal_id: string | null
          solar_kwp: number
        }
        Insert: {
          comissao?: number
          commitment_id: string
          created_at?: string
          energia_mwh?: number
          id?: string
          nif: string
          notes?: string | null
          proposal_id?: string | null
          solar_kwp?: number
        }
        Update: {
          comissao?: number
          commitment_id?: string
          created_at?: string
          energia_mwh?: number
          id?: string
          nif?: string
          notes?: string | null
          proposal_id?: string | null
          solar_kwp?: number
        }
        Relationships: [
          {
            foreignKeyName: "commitment_lines_commitment_id_fkey"
            columns: ["commitment_id"]
            isOneToOne: false
            referencedRelation: "monthly_commitments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitment_lines_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      cpes: {
        Row: {
          alert_30d_sent: boolean | null
          alert_7d_sent: boolean | null
          client_id: string
          comercializador: string
          created_at: string
          equipment_type: string
          fidelizacao_end: string | null
          fidelizacao_start: string | null
          id: string
          nivel_tensao: string | null
          notes: string | null
          organization_id: string
          renewal_status: string | null
          serial_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          alert_30d_sent?: boolean | null
          alert_7d_sent?: boolean | null
          client_id: string
          comercializador: string
          created_at?: string
          equipment_type: string
          fidelizacao_end?: string | null
          fidelizacao_start?: string | null
          id?: string
          nivel_tensao?: string | null
          notes?: string | null
          organization_id: string
          renewal_status?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          alert_30d_sent?: boolean | null
          alert_7d_sent?: boolean | null
          client_id?: string
          comercializador?: string
          created_at?: string
          equipment_type?: string
          fidelizacao_end?: string | null
          fidelizacao_start?: string | null
          id?: string
          nivel_tensao?: string | null
          notes?: string | null
          organization_id?: string
          renewal_status?: string | null
          serial_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cpes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cpes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_notes: {
        Row: {
          client_name: string | null
          created_at: string | null
          date: string | null
          id: string
          invoicexpress_id: number
          organization_id: string
          payment_id: string | null
          pdf_path: string | null
          raw_data: Json | null
          reference: string | null
          related_invoice_id: number | null
          sale_id: string | null
          status: string | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          client_name?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          invoicexpress_id: number
          organization_id: string
          payment_id?: string | null
          pdf_path?: string | null
          raw_data?: Json | null
          reference?: string | null
          related_invoice_id?: number | null
          sale_id?: string | null
          status?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          client_name?: string | null
          created_at?: string | null
          date?: string | null
          id?: string
          invoicexpress_id?: number
          organization_id?: string
          payment_id?: string | null
          pdf_path?: string | null
          raw_data?: Json | null
          reference?: string | null
          related_invoice_id?: number | null
          sale_id?: string | null
          status?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "sale_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_notes_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_clients: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          assigned_to: string | null
          billing_target: string
          city: string | null
          code: string | null
          company: string | null
          company_nif: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          lead_id: string | null
          name: string
          nif: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          source: string | null
          status: string | null
          total_comissao: number | null
          total_kwp: number | null
          total_mwh: number | null
          total_proposals: number | null
          total_sales: number | null
          total_value: number | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          assigned_to?: string | null
          billing_target?: string
          city?: string | null
          code?: string | null
          company?: string | null
          company_nif?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          lead_id?: string | null
          name: string
          nif?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          postal_code?: string | null
          source?: string | null
          status?: string | null
          total_comissao?: number | null
          total_kwp?: number | null
          total_mwh?: number | null
          total_proposals?: number | null
          total_sales?: number | null
          total_value?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          assigned_to?: string | null
          billing_target?: string
          city?: string | null
          code?: string | null
          company?: string | null
          company_nif?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          nif?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          postal_code?: string | null
          source?: string | null
          status?: string | null
          total_comissao?: number | null
          total_kwp?: number | null
          total_mwh?: number | null
          total_proposals?: number | null
          total_sales?: number | null
          total_value?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          country: string | null
          created_at: string | null
          customer_id: string
          id: string
          is_default: boolean | null
          name: string
          phone: string | null
          postal_code: string
          type: string | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          country?: string | null
          created_at?: string | null
          customer_id: string
          id?: string
          is_default?: boolean | null
          name: string
          phone?: string | null
          postal_code: string
          type?: string | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          country?: string | null
          created_at?: string | null
          customer_id?: string
          id?: string
          is_default?: boolean | null
          name?: string
          phone?: string | null
          postal_code?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          accepts_marketing: boolean | null
          created_at: string | null
          email: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          total_orders: number | null
          total_spent: number | null
          updated_at: string | null
        }
        Insert: {
          accepts_marketing?: boolean | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Update: {
          accepts_marketing?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          total_orders?: number | null
          total_spent?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_widgets: {
        Row: {
          config: Json | null
          created_at: string | null
          id: string
          is_visible: boolean
          organization_id: string
          position: number
          user_id: string
          widget_type: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_visible?: boolean
          organization_id: string
          position?: number
          user_id: string
          widget_type: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          id?: string
          is_visible?: boolean
          organization_id?: string
          position?: number
          user_id?: string
          widget_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widgets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_purchase: number | null
          organization_id: string
          starts_at: string | null
          type: string
          uses_count: number | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase?: number | null
          organization_id: string
          starts_at?: string | null
          type: string
          uses_count?: number | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_purchase?: number | null
          organization_id?: string
          starts_at?: string | null
          type?: string
          uses_count?: number | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "discount_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ecommerce_products: {
        Row: {
          category_id: string | null
          compare_at_price: number | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_digital: boolean | null
          low_stock_threshold: number | null
          name: string
          organization_id: string
          price: number | null
          requires_shipping: boolean | null
          short_description: string | null
          sku: string | null
          slug: string | null
          stock_quantity: number | null
          tags: string[] | null
          track_inventory: boolean | null
          updated_at: string | null
          weight_grams: number | null
        }
        Insert: {
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_digital?: boolean | null
          low_stock_threshold?: number | null
          name: string
          organization_id: string
          price?: number | null
          requires_shipping?: boolean | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          stock_quantity?: number | null
          tags?: string[] | null
          track_inventory?: boolean | null
          updated_at?: string | null
          weight_grams?: number | null
        }
        Update: {
          category_id?: string | null
          compare_at_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_digital?: boolean | null
          low_stock_threshold?: number | null
          name?: string
          organization_id?: string
          price?: number | null
          requires_shipping?: boolean | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          stock_quantity?: number | null
          tags?: string[] | null
          track_inventory?: boolean | null
          updated_at?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ecommerce_products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ecommerce_products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_automations: {
        Row: {
          created_at: string
          created_by: string | null
          delay_minutes: number
          id: string
          is_active: boolean
          last_triggered_at: string | null
          list_id: string | null
          name: string
          organization_id: string
          recipient_type: string
          template_id: string
          total_triggered: number
          trigger_config: Json | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delay_minutes?: number
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          list_id?: string | null
          name: string
          organization_id: string
          recipient_type?: string
          template_id: string
          total_triggered?: number
          trigger_config?: Json | null
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delay_minutes?: number
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          list_id?: string | null
          name?: string
          organization_id?: string
          recipient_type?: string
          template_id?: string
          total_triggered?: number
          trigger_config?: Json | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_automations_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "client_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_automations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          failed_count: number
          html_content: string | null
          id: string
          name: string
          organization_id: string
          scheduled_at: string | null
          sent_at: string | null
          sent_count: number
          settings: Json | null
          settings_data: Json | null
          status: string
          subject: string | null
          template_id: string | null
          total_recipients: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          failed_count?: number
          html_content?: string | null
          id?: string
          name: string
          organization_id: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          settings?: Json | null
          settings_data?: Json | null
          status?: string
          subject?: string | null
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          failed_count?: number
          html_content?: string | null
          id?: string
          name?: string
          organization_id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          settings?: Json | null
          settings_data?: Json | null
          status?: string
          subject?: string | null
          template_id?: string | null
          total_recipients?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sends: {
        Row: {
          automation_id: string | null
          brevo_message_id: string | null
          campaign_id: string | null
          clicked_at: string | null
          client_id: string | null
          created_at: string
          error_message: string | null
          id: string
          opened_at: string | null
          organization_id: string
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string
          template_id: string | null
        }
        Insert: {
          automation_id?: string | null
          brevo_message_id?: string | null
          campaign_id?: string | null
          clicked_at?: string | null
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          organization_id: string
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          template_id?: string | null
        }
        Update: {
          automation_id?: string | null
          brevo_message_id?: string | null
          campaign_id?: string | null
          clicked_at?: string | null
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          organization_id?: string
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "email_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          automation_delay_minutes: number
          automation_enabled: boolean
          automation_trigger_config: Json
          automation_trigger_type: string | null
          category: string | null
          created_at: string | null
          created_by: string | null
          html_content: string
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          subject: string
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          automation_delay_minutes?: number
          automation_enabled?: boolean
          automation_trigger_config?: Json
          automation_trigger_type?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          html_content?: string
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          subject: string
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          automation_delay_minutes?: number
          automation_enabled?: boolean
          automation_trigger_config?: Json
          automation_trigger_type?: string | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          html_content?: string
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          subject?: string
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_unsubscribe_tokens: {
        Row: {
          contact_id: string
          created_at: string
          email_send_id: string | null
          id: string
          organization_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          email_send_id?: string | null
          id?: string
          organization_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          email_send_id?: string | null
          id?: string
          organization_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_unsubscribe_tokens_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "marketing_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_unsubscribe_tokens_email_send_id_fkey"
            columns: ["email_send_id"]
            isOneToOne: false
            referencedRelation: "email_sends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_unsubscribe_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          bank_account_id: string | null
          category_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          expense_date: string
          id: string
          is_recurring: boolean | null
          notes: string | null
          organization_id: string
          receipt_file_url: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          expense_date: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          organization_id: string
          receipt_file_url?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          organization_id?: string
          receipt_file_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          ai_qualification_rules: string | null
          assigned_to: string | null
          created_at: string | null
          form_settings: Json | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          meta_pixels: Json | null
          msg_template_cold: string | null
          msg_template_hot: string | null
          msg_template_warm: string | null
          name: string
          organization_id: string
          slug: string
          target_stage: string | null
          updated_at: string | null
        }
        Insert: {
          ai_qualification_rules?: string | null
          assigned_to?: string | null
          created_at?: string | null
          form_settings?: Json | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          meta_pixels?: Json | null
          msg_template_cold?: string | null
          msg_template_hot?: string | null
          msg_template_warm?: string | null
          name: string
          organization_id: string
          slug: string
          target_stage?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_qualification_rules?: string | null
          assigned_to?: string | null
          created_at?: string | null
          form_settings?: Json | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          meta_pixels?: Json | null
          msg_template_cold?: string | null
          msg_template_hot?: string | null
          msg_template_warm?: string | null
          name?: string
          organization_id?: string
          slug?: string
          target_stage?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "forms_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_requests: {
        Row: {
          amount: number | null
          created_at: string | null
          description: string | null
          expense_date: string | null
          file_url: string | null
          id: string
          organization_id: string
          paid_at: string | null
          payment_reference: string | null
          period_end: string | null
          period_start: string | null
          request_type: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          submitted_at: string | null
          submitted_by: string
          title: string
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          expense_date?: string | null
          file_url?: string | null
          id?: string
          organization_id: string
          paid_at?: string | null
          payment_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          request_type: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by: string
          title: string
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          description?: string | null
          expense_date?: string | null
          file_url?: string | null
          id?: string
          organization_id?: string
          paid_at?: string | null
          payment_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          request_type?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          submitted_at?: string | null
          submitted_by?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          organization_id: string
          product_id: string | null
          quantity: number
          reference_id: string | null
          type: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          product_id?: string | null
          quantity: number
          reference_id?: string | null
          type: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          product_id?: string | null
          quantity?: number
          reference_id?: string | null
          type?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_name: string | null
          created_at: string | null
          date: string | null
          document_type: string | null
          due_date: string | null
          id: string
          invoicexpress_id: number
          organization_id: string
          payment_id: string | null
          pdf_path: string | null
          raw_data: Json | null
          reference: string | null
          sale_id: string | null
          status: string | null
          total: number | null
          updated_at: string | null
        }
        Insert: {
          client_name?: string | null
          created_at?: string | null
          date?: string | null
          document_type?: string | null
          due_date?: string | null
          id?: string
          invoicexpress_id: number
          organization_id: string
          payment_id?: string | null
          pdf_path?: string | null
          raw_data?: Json | null
          reference?: string | null
          sale_id?: string | null
          status?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Update: {
          client_name?: string | null
          created_at?: string | null
          date?: string | null
          document_type?: string | null
          due_date?: string | null
          id?: string
          invoicexpress_id?: number
          organization_id?: string
          payment_id?: string | null
          pdf_path?: string | null
          raw_data?: Json | null
          reference?: string | null
          sale_id?: string | null
          status?: string | null
          total?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "sale_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          lead_id: string
          organization_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          lead_id: string
          organization_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_attachments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          automation_enabled: boolean
          company_name: string | null
          company_nif: string | null
          consumo_anual: number | null
          created_at: string | null
          custom_data: Json | null
          email: string
          form_id: string | null
          gdpr_consent: boolean
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string
          source: string | null
          status: string | null
          temperature: string | null
          tipologia: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          assigned_to?: string | null
          automation_enabled?: boolean
          company_name?: string | null
          company_nif?: string | null
          consumo_anual?: number | null
          created_at?: string | null
          custom_data?: Json | null
          email: string
          form_id?: string | null
          gdpr_consent?: boolean
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone: string
          source?: string | null
          status?: string | null
          temperature?: string | null
          tipologia?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          assigned_to?: string | null
          automation_enabled?: boolean
          company_name?: string | null
          company_nif?: string | null
          consumo_anual?: number | null
          created_at?: string | null
          custom_data?: Json | null
          email?: string
          form_id?: string | null
          gdpr_consent?: boolean
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string
          source?: string | null
          status?: string | null
          temperature?: string | null
          tipologia?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_contacts: {
        Row: {
          company: string | null
          converted_to_lead: boolean
          created_at: string
          email: string | null
          id: string
          name: string
          organization_id: string
          phone: string | null
          source: string | null
          subscribed: boolean | null
          tags: Json | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          converted_to_lead?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name: string
          organization_id: string
          phone?: string | null
          source?: string | null
          subscribed?: boolean | null
          tags?: Json | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          converted_to_lead?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          organization_id?: string
          phone?: string | null
          source?: string | null
          subscribed?: boolean | null
          tags?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_list_members: {
        Row: {
          added_at: string
          contact_id: string
          id: string
          list_id: string
        }
        Insert: {
          added_at?: string
          contact_id: string
          id?: string
          list_id: string
        }
        Update: {
          added_at?: string
          contact_id?: string
          id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_list_members_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "marketing_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "client_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_commitments: {
        Row: {
          created_at: string
          id: string
          month: string
          organization_id: string
          total_comissao: number
          total_energia_mwh: number
          total_nifs: number
          total_solar_kwp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          organization_id: string
          total_comissao?: number
          total_energia_mwh?: number
          total_nifs?: number
          total_solar_kwp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          organization_id?: string
          total_comissao?: number
          total_energia_mwh?: number
          total_nifs?: number
          total_solar_kwp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_commitments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_commitments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_metrics: {
        Row: {
          comissao: number
          created_at: string
          created_by: string | null
          energia: number
          id: string
          month: string
          op_comissao: number
          op_energia: number
          op_solar: number
          organization_id: string
          solar: number
          updated_at: string
          user_id: string
        }
        Insert: {
          comissao?: number
          created_at?: string
          created_by?: string | null
          energia?: number
          id?: string
          month: string
          op_comissao?: number
          op_energia?: number
          op_solar?: number
          organization_id: string
          solar?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          comissao?: number
          created_at?: string
          created_by?: string | null
          energia?: number
          id?: string
          month?: string
          op_comissao?: number
          op_energia?: number
          op_solar?: number
          organization_id?: string
          solar?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_metrics_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_objectives: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          month: string
          organization_id: string
          total_comissao: number
          total_energia_mwh: number
          total_nifs: number
          total_solar_kwp: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          month: string
          organization_id: string
          total_comissao?: number
          total_energia_mwh?: number
          total_nifs?: number
          total_solar_kwp?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          month?: string
          organization_id?: string
          total_comissao?: number
          total_energia_mwh?: number
          total_nifs?: number
          total_solar_kwp?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_objectives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          sku: string | null
          total: number
          unit_price: number
          variant_id: string | null
          variant_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sku?: string | null
          total: number
          unit_price: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sku?: string | null
          total?: number
          unit_price?: number
          variant_id?: string | null
          variant_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          billing_address: Json | null
          created_at: string | null
          customer_id: string | null
          discount_code: string | null
          discount_total: number | null
          fulfillment_status: string | null
          id: string
          internal_notes: string | null
          lead_id: string | null
          notes: string | null
          order_number: string
          organization_id: string
          payment_status: string | null
          shipping_address: Json | null
          shipping_total: number | null
          status: string | null
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          subtotal: number
          tax_total: number | null
          total: number
          updated_at: string | null
        }
        Insert: {
          billing_address?: Json | null
          created_at?: string | null
          customer_id?: string | null
          discount_code?: string | null
          discount_total?: number | null
          fulfillment_status?: string | null
          id?: string
          internal_notes?: string | null
          lead_id?: string | null
          notes?: string | null
          order_number: string
          organization_id: string
          payment_status?: string | null
          shipping_address?: Json | null
          shipping_total?: number | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_total?: number | null
          total?: number
          updated_at?: string | null
        }
        Update: {
          billing_address?: Json | null
          created_at?: string | null
          customer_id?: string | null
          discount_code?: string | null
          discount_total?: number | null
          fulfillment_status?: string | null
          id?: string
          internal_notes?: string | null
          lead_id?: string | null
          notes?: string | null
          order_number?: string
          organization_id?: string
          payment_status?: string | null
          shipping_address?: Json | null
          shipping_total?: number | null
          status?: string | null
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          subtotal?: number
          tax_total?: number | null
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          token: string
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          commission_rate: number | null
          id: string
          is_active: boolean
          joined_at: string | null
          organization_id: string
          profile_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          commission_rate?: number | null
          id?: string
          is_active?: boolean
          joined_at?: string | null
          organization_id: string
          profile_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          commission_rate?: number | null
          id?: string
          is_active?: boolean
          joined_at?: string | null
          organization_id?: string
          profile_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "organization_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_profiles: {
        Row: {
          base_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          dashboard_widgets: Json | null
          data_scope: string
          id: string
          is_default: boolean
          module_permissions: Json
          name: string
          organization_id: string
        }
        Insert: {
          base_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          dashboard_widgets?: Json | null
          data_scope?: string
          id?: string
          is_default?: boolean
          module_permissions?: Json
          name: string
          organization_id: string
        }
        Update: {
          base_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          dashboard_widgets?: Json | null
          data_scope?: string
          id?: string
          is_default?: boolean
          module_permissions?: Json
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_webhooks: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          organization_id: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          organization_id: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          ai_qualification_rules: string | null
          billing_exempt: boolean | null
          billing_provider: string
          brevo_api_key: string | null
          brevo_sender_email: string | null
          calendar_alert_settings: Json | null
          client_fields_settings: Json | null
          code: string | null
          commission_matrix: Json | null
          created_at: string | null
          enabled_modules: Json | null
          fidelization_alert_days: Json | null
          fidelization_create_event: boolean | null
          fidelization_email: string | null
          fidelization_email_enabled: boolean | null
          fidelization_event_time: string | null
          finance_email: string | null
          form_settings: Json | null
          id: string
          integrations_enabled: Json | null
          invoicexpress_account_name: string | null
          invoicexpress_api_key: string | null
          keyinvoice_api_url: string | null
          keyinvoice_company_code: string | null
          keyinvoice_password: string | null
          keyinvoice_sid: string | null
          keyinvoice_sid_expires_at: string | null
          keyinvoice_token: string | null
          keyinvoice_token_expires_at: string | null
          keyinvoice_username: string | null
          lead_fields_settings: Json | null
          logo_url: string | null
          meta_pixels: Json | null
          msg_template_cold: string | null
          msg_template_hot: string | null
          msg_template_warm: string | null
          name: string
          niche: string | null
          payment_failed_at: string | null
          plan: string | null
          proposal_fields_settings: Json | null
          public_key: string
          sale_fields_settings: Json | null
          sales_settings: Json | null
          servicos_products_config: Json | null
          slug: string
          tax_config: Json | null
          trial_ends_at: string | null
          webhook_token: string
          webhook_url: string | null
          whatsapp_api_key: string | null
          whatsapp_base_url: string | null
          whatsapp_instance: string | null
        }
        Insert: {
          ai_qualification_rules?: string | null
          billing_exempt?: boolean | null
          billing_provider?: string
          brevo_api_key?: string | null
          brevo_sender_email?: string | null
          calendar_alert_settings?: Json | null
          client_fields_settings?: Json | null
          code?: string | null
          commission_matrix?: Json | null
          created_at?: string | null
          enabled_modules?: Json | null
          fidelization_alert_days?: Json | null
          fidelization_create_event?: boolean | null
          fidelization_email?: string | null
          fidelization_email_enabled?: boolean | null
          fidelization_event_time?: string | null
          finance_email?: string | null
          form_settings?: Json | null
          id?: string
          integrations_enabled?: Json | null
          invoicexpress_account_name?: string | null
          invoicexpress_api_key?: string | null
          keyinvoice_api_url?: string | null
          keyinvoice_company_code?: string | null
          keyinvoice_password?: string | null
          keyinvoice_sid?: string | null
          keyinvoice_sid_expires_at?: string | null
          keyinvoice_token?: string | null
          keyinvoice_token_expires_at?: string | null
          keyinvoice_username?: string | null
          lead_fields_settings?: Json | null
          logo_url?: string | null
          meta_pixels?: Json | null
          msg_template_cold?: string | null
          msg_template_hot?: string | null
          msg_template_warm?: string | null
          name: string
          niche?: string | null
          payment_failed_at?: string | null
          plan?: string | null
          proposal_fields_settings?: Json | null
          public_key?: string
          sale_fields_settings?: Json | null
          sales_settings?: Json | null
          servicos_products_config?: Json | null
          slug: string
          tax_config?: Json | null
          trial_ends_at?: string | null
          webhook_token?: string
          webhook_url?: string | null
          whatsapp_api_key?: string | null
          whatsapp_base_url?: string | null
          whatsapp_instance?: string | null
        }
        Update: {
          ai_qualification_rules?: string | null
          billing_exempt?: boolean | null
          billing_provider?: string
          brevo_api_key?: string | null
          brevo_sender_email?: string | null
          calendar_alert_settings?: Json | null
          client_fields_settings?: Json | null
          code?: string | null
          commission_matrix?: Json | null
          created_at?: string | null
          enabled_modules?: Json | null
          fidelization_alert_days?: Json | null
          fidelization_create_event?: boolean | null
          fidelization_email?: string | null
          fidelization_email_enabled?: boolean | null
          fidelization_event_time?: string | null
          finance_email?: string | null
          form_settings?: Json | null
          id?: string
          integrations_enabled?: Json | null
          invoicexpress_account_name?: string | null
          invoicexpress_api_key?: string | null
          keyinvoice_api_url?: string | null
          keyinvoice_company_code?: string | null
          keyinvoice_password?: string | null
          keyinvoice_sid?: string | null
          keyinvoice_sid_expires_at?: string | null
          keyinvoice_token?: string | null
          keyinvoice_token_expires_at?: string | null
          keyinvoice_username?: string | null
          lead_fields_settings?: Json | null
          logo_url?: string | null
          meta_pixels?: Json | null
          msg_template_cold?: string | null
          msg_template_hot?: string | null
          msg_template_warm?: string | null
          name?: string
          niche?: string | null
          payment_failed_at?: string | null
          plan?: string | null
          proposal_fields_settings?: Json | null
          public_key?: string
          sale_fields_settings?: Json | null
          sales_settings?: Json | null
          servicos_products_config?: Json | null
          slug?: string
          tax_config?: Json | null
          trial_ends_at?: string | null
          webhook_token?: string
          webhook_url?: string | null
          whatsapp_api_key?: string | null
          whatsapp_base_url?: string | null
          whatsapp_instance?: string | null
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          created_at: string | null
          id: string
          is_final_negative: boolean | null
          is_final_positive: boolean | null
          key: string
          name: string
          organization_id: string
          position: number
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          is_final_negative?: boolean | null
          is_final_positive?: boolean | null
          key: string
          name: string
          organization_id: string
          position?: number
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          is_final_negative?: boolean | null
          is_final_positive?: boolean | null
          key?: string
          name?: string
          organization_id?: string
          position?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          organization_id: string
          parent_id: string | null
          position: number | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          organization_id: string
          parent_id?: string | null
          position?: number | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          organization_id?: string
          parent_id?: string | null
          position?: number | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string | null
          id: string
          is_primary: boolean | null
          position: number | null
          product_id: string
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          position?: number | null
          product_id: string
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          position?: number | null
          product_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          compare_at_price: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          low_stock_threshold: number | null
          name: string
          options: Json | null
          price: number
          product_id: string
          sku: string | null
          stock_quantity: number | null
          updated_at: string | null
          weight_grams: number | null
        }
        Insert: {
          compare_at_price?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          low_stock_threshold?: number | null
          name: string
          options?: Json | null
          price: number
          product_id: string
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
          weight_grams?: number | null
        }
        Update: {
          compare_at_price?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          low_stock_threshold?: number | null
          name?: string
          options?: Json | null
          price?: number
          product_id?: string
          sku?: string | null
          stock_quantity?: number | null
          updated_at?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "ecommerce_products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          code: string | null
          compare_at_price: number | null
          created_at: string | null
          description: string | null
          id: string
          invoicexpress_id: number | null
          is_active: boolean | null
          is_digital: boolean | null
          is_ecommerce: boolean | null
          is_recurring: boolean | null
          low_stock_threshold: number | null
          name: string
          organization_id: string
          price: number | null
          requires_shipping: boolean | null
          short_description: string | null
          sku: string | null
          slug: string | null
          stock_quantity: number | null
          tags: string[] | null
          tax_exemption_reason: string | null
          tax_value: number | null
          track_inventory: boolean | null
          updated_at: string | null
          weight_grams: number | null
        }
        Insert: {
          category_id?: string | null
          code?: string | null
          compare_at_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          invoicexpress_id?: number | null
          is_active?: boolean | null
          is_digital?: boolean | null
          is_ecommerce?: boolean | null
          is_recurring?: boolean | null
          low_stock_threshold?: number | null
          name: string
          organization_id: string
          price?: number | null
          requires_shipping?: boolean | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          stock_quantity?: number | null
          tags?: string[] | null
          tax_exemption_reason?: string | null
          tax_value?: number | null
          track_inventory?: boolean | null
          updated_at?: string | null
          weight_grams?: number | null
        }
        Update: {
          category_id?: string | null
          code?: string | null
          compare_at_price?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          invoicexpress_id?: number | null
          is_active?: boolean | null
          is_digital?: boolean | null
          is_ecommerce?: boolean | null
          is_recurring?: boolean | null
          low_stock_threshold?: number | null
          name?: string
          organization_id?: string
          price?: number | null
          requires_shipping?: boolean | null
          short_description?: string | null
          sku?: string | null
          slug?: string | null
          stock_quantity?: number | null
          tags?: string[] | null
          tax_exemption_reason?: string | null
          tax_value?: number | null
          track_inventory?: boolean | null
          updated_at?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          brevo_sender_email: string | null
          created_at: string | null
          email: string | null
          email_signature: string | null
          full_name: string
          id: string
          organization_id: string | null
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          brevo_sender_email?: string | null
          created_at?: string | null
          email?: string | null
          email_signature?: string | null
          full_name: string
          id: string
          organization_id?: string | null
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          brevo_sender_email?: string | null
          created_at?: string | null
          email?: string | null
          email_signature?: string | null
          full_name?: string
          id?: string
          organization_id?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_cpes: {
        Row: {
          comercializador: string
          comissao: number | null
          consumo_anual: number | null
          contrato_fim: string | null
          contrato_inicio: string | null
          created_at: string
          dbl: number | null
          duracao_contrato: number | null
          equipment_type: string
          existing_cpe_id: string | null
          fidelizacao_end: string | null
          fidelizacao_start: string | null
          id: string
          margem: number | null
          notes: string | null
          proposal_id: string
          serial_number: string | null
        }
        Insert: {
          comercializador: string
          comissao?: number | null
          consumo_anual?: number | null
          contrato_fim?: string | null
          contrato_inicio?: string | null
          created_at?: string
          dbl?: number | null
          duracao_contrato?: number | null
          equipment_type: string
          existing_cpe_id?: string | null
          fidelizacao_end?: string | null
          fidelizacao_start?: string | null
          id?: string
          margem?: number | null
          notes?: string | null
          proposal_id: string
          serial_number?: string | null
        }
        Update: {
          comercializador?: string
          comissao?: number | null
          consumo_anual?: number | null
          contrato_fim?: string | null
          contrato_inicio?: string | null
          created_at?: string
          dbl?: number | null
          duracao_contrato?: number | null
          equipment_type?: string
          existing_cpe_id?: string | null
          fidelizacao_end?: string | null
          fidelizacao_start?: string | null
          id?: string
          margem?: number | null
          notes?: string | null
          proposal_id?: string
          serial_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_cpes_existing_cpe_id_fkey"
            columns: ["existing_cpe_id"]
            isOneToOne: false
            referencedRelation: "cpes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_cpes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_products: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          proposal_id: string
          quantity: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          proposal_id: string
          quantity?: number
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          proposal_id?: string
          quantity?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposal_products_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          accepted_at: string | null
          anos_contrato: number | null
          client_id: string | null
          code: string | null
          comissao: number | null
          consumo_anual: number | null
          created_at: string | null
          created_by: string | null
          dbl: number | null
          id: string
          kwp: number | null
          lead_id: string | null
          margem: number | null
          modelo_servico: string | null
          negotiation_type: string | null
          notes: string | null
          organization_id: string
          proposal_date: string | null
          proposal_type: string | null
          servicos_details: Json | null
          servicos_produtos: string[] | null
          status: string
          total_value: number
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          anos_contrato?: number | null
          client_id?: string | null
          code?: string | null
          comissao?: number | null
          consumo_anual?: number | null
          created_at?: string | null
          created_by?: string | null
          dbl?: number | null
          id?: string
          kwp?: number | null
          lead_id?: string | null
          margem?: number | null
          modelo_servico?: string | null
          negotiation_type?: string | null
          notes?: string | null
          organization_id: string
          proposal_date?: string | null
          proposal_type?: string | null
          servicos_details?: Json | null
          servicos_produtos?: string[] | null
          status?: string
          total_value?: number
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          anos_contrato?: number | null
          client_id?: string | null
          code?: string | null
          comissao?: number | null
          consumo_anual?: number | null
          created_at?: string | null
          created_by?: string | null
          dbl?: number | null
          id?: string
          kwp?: number | null
          lead_id?: string | null
          margem?: number | null
          modelo_servico?: string | null
          negotiation_type?: string | null
          notes?: string | null
          organization_id?: string
          proposal_date?: string | null
          proposal_type?: string | null
          servicos_details?: Json | null
          servicos_produtos?: string[] | null
          status?: string
          total_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      prospect_generation_jobs: {
        Row: {
          apify_run_id: string | null
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          organization_id: string
          result: Json | null
          search_params: Json | null
          status: string
          user_id: string
        }
        Insert: {
          apify_run_id?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          organization_id: string
          result?: Json | null
          search_params?: Json | null
          status?: string
          user_id: string
        }
        Update: {
          apify_run_id?: string | null
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          organization_id?: string
          result?: Json | null
          search_params?: Json | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_generation_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prospects: {
        Row: {
          annual_consumption_kwh: number | null
          assigned_at: string | null
          assigned_to: string | null
          company_name: string
          contact_name: string | null
          converted_at: string | null
          converted_lead_id: string | null
          converted_to_lead: boolean
          cpe: string | null
          created_at: string
          email: string | null
          id: string
          imported_at: string
          imported_by: string | null
          metadata: Json
          nif: string | null
          observations: string | null
          organization_id: string
          phone: string | null
          segment: string | null
          source: string
          source_file_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          annual_consumption_kwh?: number | null
          assigned_at?: string | null
          assigned_to?: string | null
          company_name: string
          contact_name?: string | null
          converted_at?: string | null
          converted_lead_id?: string | null
          converted_to_lead?: boolean
          cpe?: string | null
          created_at?: string
          email?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          metadata?: Json
          nif?: string | null
          observations?: string | null
          organization_id: string
          phone?: string | null
          segment?: string | null
          source?: string
          source_file_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          annual_consumption_kwh?: number | null
          assigned_at?: string | null
          assigned_to?: string | null
          company_name?: string
          contact_name?: string | null
          converted_at?: string | null
          converted_lead_id?: string | null
          converted_to_lead?: boolean
          cpe?: string | null
          created_at?: string
          email?: string | null
          id?: string
          imported_at?: string
          imported_by?: string | null
          metadata?: Json
          nif?: string | null
          observations?: string | null
          organization_id?: string
          phone?: string | null
          segment?: string | null
          source?: string
          source_file_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          organization_id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          organization_id: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          organization_id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_automation_runs: {
        Row: {
          created_at: string
          failed_at: string | null
          id: string
          last_error: string | null
          organization_id: string
          renewal_date: string
          renewal_payment_id: string | null
          sale_id: string
          sent_at: string | null
          status: string
          template_id: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          failed_at?: string | null
          id?: string
          last_error?: string | null
          organization_id: string
          renewal_date: string
          renewal_payment_id?: string | null
          sale_id: string
          sent_at?: string | null
          status?: string
          template_id: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          failed_at?: string | null
          id?: string
          last_error?: string | null
          organization_id?: string
          renewal_date?: string
          renewal_payment_id?: string | null
          sale_id?: string
          sent_at?: string | null
          status?: string
          template_id?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_automation_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_automation_runs_renewal_payment_id_fkey"
            columns: ["renewal_payment_id"]
            isOneToOne: false
            referencedRelation: "sale_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_automation_runs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_automation_runs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_absence_periods: {
        Row: {
          absence_id: string
          business_days: number
          created_at: string
          end_date: string
          end_time: string | null
          id: string
          period_type: string
          start_date: string
          start_time: string | null
          status: string
        }
        Insert: {
          absence_id: string
          business_days?: number
          created_at?: string
          end_date: string
          end_time?: string | null
          id?: string
          period_type?: string
          start_date: string
          start_time?: string | null
          status?: string
        }
        Update: {
          absence_id?: string
          business_days?: number
          created_at?: string
          end_date?: string
          end_time?: string | null
          id?: string
          period_type?: string
          start_date?: string
          start_time?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_absence_periods_absence_id_fkey"
            columns: ["absence_id"]
            isOneToOne: false
            referencedRelation: "rh_absences"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_absences: {
        Row: {
          absence_type: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          end_date: string
          id: string
          notes: string | null
          organization_id: string
          rejection_reason: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          absence_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date: string
          id?: string
          notes?: string | null
          organization_id: string
          rejection_reason?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          absence_type?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          end_date?: string
          id?: string
          notes?: string | null
          organization_id?: string
          rejection_reason?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rh_absences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_holidays: {
        Row: {
          created_at: string
          date: string
          id: string
          is_national: boolean
          name: string
          organization_id: string
          year: number
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_national?: boolean
          name: string
          organization_id: string
          year: number
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_national?: boolean
          name?: string
          organization_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "rh_holidays_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rh_vacation_balances: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          total_days: number
          updated_at: string
          used_days: number
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "rh_vacation_balances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_activation_history: {
        Row: {
          activation_date: string
          changed_by: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          sale_id: string
        }
        Insert: {
          activation_date: string
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          sale_id: string
        }
        Update: {
          activation_date?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_activation_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_activation_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_activation_history_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string | null
          first_due_date: string | null
          id: string
          name: string
          product_id: string | null
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          first_due_date?: string | null
          id?: string
          name: string
          product_id?: string | null
          quantity?: number
          sale_id: string
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          first_due_date?: string | null
          id?: string
          name?: string
          product_id?: string | null
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string | null
          credit_note_id: number | null
          credit_note_reference: string | null
          id: string
          invoice_file_url: string | null
          invoice_reference: string | null
          invoicexpress_id: number | null
          notes: string | null
          organization_id: string
          payment_date: string
          payment_method: string | null
          qr_code_url: string | null
          sale_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string | null
          credit_note_id?: number | null
          credit_note_reference?: string | null
          id?: string
          invoice_file_url?: string | null
          invoice_reference?: string | null
          invoicexpress_id?: number | null
          notes?: string | null
          organization_id: string
          payment_date: string
          payment_method?: string | null
          qr_code_url?: string | null
          sale_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string | null
          credit_note_id?: number | null
          credit_note_reference?: string | null
          id?: string
          invoice_file_url?: string | null
          invoice_reference?: string | null
          invoicexpress_id?: number | null
          notes?: string | null
          organization_id?: string
          payment_date?: string
          payment_method?: string | null
          qr_code_url?: string | null
          sale_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          activation_date: string | null
          anos_contrato: number | null
          client_id: string | null
          client_org_id: string | null
          code: string | null
          comissao: number | null
          consumo_anual: number | null
          created_at: string | null
          created_by: string | null
          credit_note_id: number | null
          credit_note_reference: string | null
          dbl: number | null
          discount: number | null
          due_date: string | null
          edp_proposal_number: string | null
          has_recurring: boolean | null
          id: string
          invoice_pdf_url: string | null
          invoice_reference: string | null
          invoicexpress_id: number | null
          invoicexpress_type: string | null
          kwp: number | null
          last_renewal_date: string | null
          lead_id: string | null
          margem: number | null
          modelo_servico: string | null
          negotiation_type: string | null
          next_renewal_date: string | null
          notes: string | null
          organization_id: string
          paid_date: string | null
          payment_method: string | null
          payment_status: string | null
          proposal_id: string | null
          proposal_type: string | null
          qr_code_url: string | null
          recurring_status: string | null
          recurring_value: number | null
          sale_date: string | null
          servicos_details: Json | null
          servicos_produtos: string[] | null
          status: string
          subtotal: number | null
          total_value: number
          updated_at: string | null
        }
        Insert: {
          activation_date?: string | null
          anos_contrato?: number | null
          client_id?: string | null
          client_org_id?: string | null
          code?: string | null
          comissao?: number | null
          consumo_anual?: number | null
          created_at?: string | null
          created_by?: string | null
          credit_note_id?: number | null
          credit_note_reference?: string | null
          dbl?: number | null
          discount?: number | null
          due_date?: string | null
          edp_proposal_number?: string | null
          has_recurring?: boolean | null
          id?: string
          invoice_pdf_url?: string | null
          invoice_reference?: string | null
          invoicexpress_id?: number | null
          invoicexpress_type?: string | null
          kwp?: number | null
          last_renewal_date?: string | null
          lead_id?: string | null
          margem?: number | null
          modelo_servico?: string | null
          negotiation_type?: string | null
          next_renewal_date?: string | null
          notes?: string | null
          organization_id: string
          paid_date?: string | null
          payment_method?: string | null
          payment_status?: string | null
          proposal_id?: string | null
          proposal_type?: string | null
          qr_code_url?: string | null
          recurring_status?: string | null
          recurring_value?: number | null
          sale_date?: string | null
          servicos_details?: Json | null
          servicos_produtos?: string[] | null
          status?: string
          subtotal?: number | null
          total_value?: number
          updated_at?: string | null
        }
        Update: {
          activation_date?: string | null
          anos_contrato?: number | null
          client_id?: string | null
          client_org_id?: string | null
          code?: string | null
          comissao?: number | null
          consumo_anual?: number | null
          created_at?: string | null
          created_by?: string | null
          credit_note_id?: number | null
          credit_note_reference?: string | null
          dbl?: number | null
          discount?: number | null
          due_date?: string | null
          edp_proposal_number?: string | null
          has_recurring?: boolean | null
          id?: string
          invoice_pdf_url?: string | null
          invoice_reference?: string | null
          invoicexpress_id?: number | null
          invoicexpress_type?: string | null
          kwp?: number | null
          last_renewal_date?: string | null
          lead_id?: string | null
          margem?: number | null
          modelo_servico?: string | null
          negotiation_type?: string | null
          next_renewal_date?: string | null
          notes?: string | null
          organization_id?: string
          paid_date?: string | null
          payment_method?: string | null
          payment_status?: string | null
          proposal_id?: string | null
          proposal_type?: string | null
          qr_code_url?: string | null
          recurring_status?: string | null
          recurring_value?: number | null
          sale_date?: string | null
          servicos_details?: Json | null
          servicos_produtos?: string[] | null
          status?: string
          subtotal?: number | null
          total_value?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          created_at: string | null
          delivered_at: string | null
          id: string
          notes: string | null
          order_id: string
          organization_id: string
          shipped_at: string | null
          status: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          notes?: string | null
          order_id: string
          organization_id: string
          shipped_at?: string | null
          status?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string | null
          delivered_at?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          organization_id?: string
          shipped_at?: string | null
          status?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_commission_records: {
        Row: {
          amount: number
          client_org_id: string
          commission_amount: number
          commission_rate: number
          created_at: string
          id: string
          organization_id: string
          period_end: string | null
          period_start: string | null
          plan: string | null
          sale_id: string
          status: string
          stripe_invoice_id: string | null
          user_id: string
        }
        Insert: {
          amount?: number
          client_org_id: string
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          organization_id: string
          period_end?: string | null
          period_start?: string | null
          plan?: string | null
          sale_id: string
          status?: string
          stripe_invoice_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          client_org_id?: string
          commission_amount?: number
          commission_rate?: number
          created_at?: string
          id?: string
          organization_id?: string
          period_end?: string | null
          period_start?: string | null
          plan?: string | null
          sale_id?: string
          status?: string
          stripe_invoice_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_commission_records_client_org_id_fkey"
            columns: ["client_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_commission_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_commission_records_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          features: Json
          id: string
          max_forms: number | null
          max_users: number | null
          name: string
          price_monthly: number
        }
        Insert: {
          created_at?: string
          features?: Json
          id: string
          max_forms?: number | null
          max_users?: number | null
          name: string
          price_monthly?: number
        }
        Update: {
          created_at?: string
          features?: Json
          id?: string
          max_forms?: number | null
          max_users?: number | null
          name?: string
          price_monthly?: number
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          attachments: Json | null
          created_at: string
          description: string
          id: string
          organization_id: string
          priority: string
          status: string
          subject: string
          ticket_code: string | null
          user_id: string
        }
        Insert: {
          attachments?: Json | null
          created_at?: string
          description: string
          id?: string
          organization_id: string
          priority?: string
          status?: string
          subject: string
          ticket_code?: string | null
          user_id: string
        }
        Update: {
          attachments?: Json | null
          created_at?: string
          description?: string
          id?: string
          organization_id?: string
          priority?: string
          status?: string
          subject?: string
          ticket_code?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          id: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          leader_id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          leader_id: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          leader_id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: {
        Args: { _token: string; _user_id: string }
        Returns: boolean
      }
      acquire_renewal_automation_run: {
        Args: {
          p_organization_id: string
          p_renewal_date: string
          p_renewal_payment_id?: string
          p_sale_id: string
          p_template_id: string
          p_trigger_type: string
        }
        Returns: string
      }
      calc_bank_running_balance: {
        Args: { _bank_account_id: string; _transaction_date: string }
        Returns: number
      }
      create_organization_for_current_user: {
        Args: { _name: string; _slug: string }
        Returns: string
      }
      distribute_prospects_round_robin:
        | {
            Args: {
              p_organization_id: string
              p_prospect_ids: string[]
              p_quantity: number
              p_salesperson_ids?: string[]
            }
            Returns: {
              created_leads_count: number
              distributed_count: number
            }[]
          }
        | {
            Args: {
              p_organization_id: string
              p_prospect_ids: string[]
              p_salesperson_ids?: string[]
            }
            Returns: {
              created_leads_count: number
              distributed_count: number
            }[]
          }
        | {
            Args: {
              p_organization_id: string
              p_quantity: number
              p_salesperson_ids?: string[]
            }
            Returns: {
              created_leads_count: number
              distributed_count: number
            }[]
          }
      ensure_newsletter_removed_list: {
        Args: { p_org_id: string }
        Returns: string
      }
      ensure_org_auto_lists: { Args: { p_org_id: string }; Returns: undefined }
      ensure_stripe_auto_lists: {
        Args: { p_org_id: string }
        Returns: undefined
      }
      generate_client_code: { Args: { _org_id: string }; Returns: string }
      generate_order_number: { Args: { _org_id: string }; Returns: string }
      generate_product_code: { Args: { _org_id: string }; Returns: string }
      generate_proposal_code: { Args: { _org_id: string }; Returns: string }
      generate_sale_code: { Args: { _org_id: string }; Returns: string }
      get_all_organizations: {
        Args: never
        Returns: {
          member_count: number
          organization_code: string
          organization_id: string
          organization_name: string
          organization_slug: string
        }[]
      }
      get_form_by_slugs: {
        Args: { _form_slug?: string; _org_slug: string }
        Returns: {
          form_id: string
          form_name: string
          form_settings: Json
          meta_pixels: Json
          org_id: string
          org_name: string
          org_slug: string
          public_key: string
        }[]
      }
      get_org_by_public_key: { Args: { _public_key: string }; Returns: string }
      get_org_name_by_invite_token: {
        Args: { _token: string }
        Returns: string
      }
      get_org_salespeople: {
        Args: { p_org_id: string }
        Returns: {
          full_name: string
          user_id: string
        }[]
      }
      get_public_form_by_key: {
        Args: { _public_key: string }
        Returns: {
          form_settings: Json
          id: string
          name: string
        }[]
      }
      get_public_form_by_slug: {
        Args: { _slug: string }
        Returns: {
          form_settings: Json
          id: string
          meta_pixels: Json
          name: string
          public_key: string
        }[]
      }
      get_slug_by_public_key: { Args: { _public_key: string }; Returns: string }
      get_team_member_ids: { Args: { p_user_id: string }; Returns: string[] }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      get_user_organizations: {
        Args: { _user_id: string }
        Returns: {
          is_active: boolean
          member_role: Database["public"]["Enums"]["app_role"]
          organization_code: string
          organization_id: string
          organization_name: string
          organization_slug: string
        }[]
      }
      handle_email_unsubscribe: {
        Args: { p_token: string }
        Returns: {
          message: string
          success: boolean
        }[]
      }
      has_finance_approve_permission: {
        Args: { _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      import_commission_chargebacks:
        | {
            Args: {
              p_cpe_column_name: string
              p_file_name: string
              p_organization_id: string
              p_rows: Json
            }
            Returns: {
              chargeback_count: number
              import_id: string
              matched_rows: number
              total_chargeback_amount: number
              total_rows: number
              unmatched_rows: number
            }[]
          }
        | {
            Args: {
              p_cpe_column_name: string
              p_file_name: string
              p_organization_id: string
              p_reference_month?: string
              p_rows: Json
            }
            Returns: {
              chargeback_count: number
              import_id: string
              matched_rows: number
              total_chargeback_amount: number
              total_rows: number
              unmatched_rows: number
            }[]
          }
      is_org_admin: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_slug_available: { Args: { _slug: string }; Returns: boolean }
      mark_renewal_automation_run: {
        Args: { p_last_error?: string; p_run_id: string; p_status: string }
        Returns: undefined
      }
      normalize_chargeback_cpe: { Args: { p_cpe: string }; Returns: string }
      parse_chargeback_amount: { Args: { p_value: string }; Returns: number }
      search_clients_unaccent: {
        Args: { max_results?: number; org_id: string; search_term: string }
        Returns: {
          address_line1: string | null
          address_line2: string | null
          assigned_to: string | null
          billing_target: string
          city: string | null
          code: string | null
          company: string | null
          company_nif: string | null
          country: string | null
          created_at: string | null
          email: string | null
          id: string
          lead_id: string | null
          name: string
          nif: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          postal_code: string | null
          source: string | null
          status: string | null
          total_comissao: number | null
          total_kwp: number | null
          total_mwh: number | null
          total_proposals: number | null
          total_sales: number | null
          total_value: number | null
          updated_at: string | null
          whatsapp: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "crm_clients"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_credit_notes_unaccent: {
        Args: {
          cn_status?: string
          max_results?: number
          org_id: string
          search_term: string
        }
        Returns: {
          client_name: string | null
          created_at: string | null
          date: string | null
          id: string
          invoicexpress_id: number
          organization_id: string
          payment_id: string | null
          pdf_path: string | null
          raw_data: Json | null
          reference: string | null
          related_invoice_id: number | null
          sale_id: string | null
          status: string | null
          total: number | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "credit_notes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_invoices_unaccent: {
        Args: {
          inv_status?: string
          max_results?: number
          org_id: string
          search_term: string
        }
        Returns: {
          client_name: string | null
          created_at: string | null
          date: string | null
          document_type: string | null
          due_date: string | null
          id: string
          invoicexpress_id: number
          organization_id: string
          payment_id: string | null
          pdf_path: string | null
          raw_data: Json | null
          reference: string | null
          sale_id: string | null
          status: string | null
          total: number | null
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "invoices"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_leads_unaccent: {
        Args: {
          lead_status?: string
          max_results?: number
          org_id: string
          search_term: string
        }
        Returns: {
          assigned_to: string | null
          automation_enabled: boolean
          company_name: string | null
          company_nif: string | null
          consumo_anual: number | null
          created_at: string | null
          custom_data: Json | null
          email: string
          form_id: string | null
          gdpr_consent: boolean
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string
          source: string | null
          status: string | null
          temperature: string | null
          tipologia: string | null
          updated_at: string | null
          value: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "leads"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_organizations_by_name: {
        Args: { _caller_org_id: string; _limit?: number; _search: string }
        Returns: {
          id: string
          name: string
          slug: string
        }[]
      }
      search_proposals_unaccent: {
        Args: {
          max_results?: number
          org_id: string
          prop_status?: string
          search_term: string
        }
        Returns: {
          accepted_at: string | null
          anos_contrato: number | null
          client_id: string | null
          code: string | null
          comissao: number | null
          consumo_anual: number | null
          created_at: string | null
          created_by: string | null
          dbl: number | null
          id: string
          kwp: number | null
          lead_id: string | null
          margem: number | null
          modelo_servico: string | null
          negotiation_type: string | null
          notes: string | null
          organization_id: string
          proposal_date: string | null
          proposal_type: string | null
          servicos_details: Json | null
          servicos_produtos: string[] | null
          status: string
          total_value: number
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "proposals"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      search_sales_unaccent: {
        Args: {
          max_results?: number
          org_id: string
          pay_status?: string
          search_term: string
        }
        Returns: {
          activation_date: string | null
          anos_contrato: number | null
          client_id: string | null
          client_org_id: string | null
          code: string | null
          comissao: number | null
          consumo_anual: number | null
          created_at: string | null
          created_by: string | null
          credit_note_id: number | null
          credit_note_reference: string | null
          dbl: number | null
          discount: number | null
          due_date: string | null
          edp_proposal_number: string | null
          has_recurring: boolean | null
          id: string
          invoice_pdf_url: string | null
          invoice_reference: string | null
          invoicexpress_id: number | null
          invoicexpress_type: string | null
          kwp: number | null
          last_renewal_date: string | null
          lead_id: string | null
          margem: number | null
          modelo_servico: string | null
          negotiation_type: string | null
          next_renewal_date: string | null
          notes: string | null
          organization_id: string
          paid_date: string | null
          payment_method: string | null
          payment_status: string | null
          proposal_id: string | null
          proposal_type: string | null
          qr_code_url: string | null
          recurring_status: string | null
          recurring_value: number | null
          sale_date: string | null
          servicos_details: Json | null
          servicos_produtos: string[] | null
          status: string
          subtotal: number | null
          total_value: number
          updated_at: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "sales"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      unaccent: { Args: { "": string }; Returns: string }
      verify_user_org_membership: {
        Args: { p_email: string; p_org_slug: string }
        Returns: {
          is_member: boolean
          organization_id: string
          organization_name: string
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "viewer" | "salesperson"
      rh_absence_status:
        | "pending"
        | "approved"
        | "partially_approved"
        | "rejected"
      rh_absence_type:
        | "vacation"
        | "sick_leave"
        | "appointment"
        | "personal_leave"
        | "training"
        | "other"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "admin", "viewer", "salesperson"],
      rh_absence_status: [
        "pending",
        "approved",
        "partially_approved",
        "rejected",
      ],
      rh_absence_type: [
        "vacation",
        "sick_leave",
        "appointment",
        "personal_leave",
        "training",
        "other",
      ],
    },
  },
} as const
