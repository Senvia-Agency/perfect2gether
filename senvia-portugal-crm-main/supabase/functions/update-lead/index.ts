import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Valid temperature values
const VALID_TEMPERATURES = ['cold', 'warm', 'hot'] as const;
type LeadTemperature = typeof VALID_TEMPERATURES[number];

interface UpdateLeadRequest {
  lead_id: string;
  organization_id: string;
  updates: {
    status?: string;
    temperature?: LeadTemperature;
    notes?: string;
    value?: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate HTTP method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate API key
    const apiKey = req.headers.get('x-api-key');
    const expectedApiKey = Deno.env.get('N8N_WEBHOOK_SECRET');

    if (!expectedApiKey) {
      console.error('N8N_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!apiKey || apiKey !== expectedApiKey) {
      console.warn('Invalid or missing API key');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body: UpdateLeadRequest = await req.json();
    console.info('Received update-lead request:', JSON.stringify({
      lead_id: body.lead_id,
      organization_id: body.organization_id,
      updates: Object.keys(body.updates || {})
    }));

    // UUID validation regex
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    // Validate required fields
    if (!body.lead_id) {
      return new Response(
        JSON.stringify({ error: 'lead_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate lead_id is a valid UUID
    if (!UUID_REGEX.test(body.lead_id)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid lead_id format',
          details: 'lead_id must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.organization_id) {
      return new Response(
        JSON.stringify({ error: 'organization_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate organization_id is a valid UUID
    if (!UUID_REGEX.test(body.organization_id)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid organization_id format',
          details: 'organization_id must be a valid UUID'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!body.updates || Object.keys(body.updates).length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one field in updates is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate status dynamically against pipeline_stages
    if (body.updates.status) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      if (!supabaseUrl || !serviceRoleKey) {
        return new Response(
          JSON.stringify({ error: 'Server configuration error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const sbForValidation = createClient(supabaseUrl, serviceRoleKey);
      const { data: validStages, error: stagesError } = await sbForValidation
        .from('pipeline_stages')
        .select('key')
        .eq('organization_id', body.organization_id);

      if (stagesError) {
        console.error('Error fetching pipeline stages:', stagesError);
        return new Response(
          JSON.stringify({ error: 'Failed to validate status' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const validKeys = validStages?.map((s: { key: string }) => s.key) || [];
      if (!validKeys.includes(body.updates.status)) {
        return new Response(
          JSON.stringify({ 
            error: 'Invalid status value',
            details: `Status must be one of: ${validKeys.join(', ')}`
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validate temperature if provided
    if (body.updates.temperature && !VALID_TEMPERATURES.includes(body.updates.temperature)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid temperature value',
          details: `Temperature must be one of: ${VALID_TEMPERATURES.join(', ')}`
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate value if provided (must be a number)
    if (body.updates.value !== undefined && typeof body.updates.value !== 'number') {
      return new Response(
        JSON.stringify({ error: 'value must be a number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (body.updates.status) updateData.status = body.updates.status;
    if (body.updates.temperature) updateData.temperature = body.updates.temperature;
    if (body.updates.notes !== undefined) updateData.notes = body.updates.notes;
    if (body.updates.value !== undefined) updateData.value = body.updates.value;

    console.info('Updating lead with:', JSON.stringify(updateData));

    // Update the lead (with organization_id check for security)
    const { data: lead, error: updateError } = await supabase
      .from('leads')
      .update(updateData)
      .eq('id', body.lead_id)
      .eq('organization_id', body.organization_id)
      .select('id, name, email, phone, status, temperature, value, notes, updated_at')
      .single();

    if (updateError) {
      console.error('Database error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update lead', details: updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!lead) {
      console.warn('Lead not found or does not belong to organization');
      return new Response(
        JSON.stringify({ error: 'Lead not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.info('Lead updated successfully:', lead.id);

    return new Response(
      JSON.stringify({
        success: true,
        lead
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
