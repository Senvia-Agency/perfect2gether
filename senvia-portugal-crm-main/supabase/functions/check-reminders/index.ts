import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for upcoming event reminders...');

    // Find events where reminder should be sent
    // Condition: start_time - reminder_minutes <= NOW AND reminder_sent = false
    const now = new Date();
    
    const { data: events, error: fetchError } = await supabase
      .from('calendar_events')
      .select(`
        id,
        title,
        event_type,
        start_time,
        reminder_minutes,
        user_id,
        organization_id,
        lead:leads(id, name)
      `)
      .eq('reminder_sent', false)
      .not('reminder_minutes', 'is', null)
      .eq('status', 'pending');

    if (fetchError) {
      console.error('Error fetching events:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${events?.length || 0} events with reminders configured`);

    const eventsToNotify = (events || []).filter(event => {
      const startTime = new Date(event.start_time);
      const reminderTime = new Date(startTime.getTime() - (event.reminder_minutes * 60 * 1000));
      return reminderTime <= now && startTime > now;
    });

    console.log(`${eventsToNotify.length} events need reminders sent now`);

    const results = [];

    for (const event of eventsToNotify) {
      try {
        const leadData = Array.isArray(event.lead) ? event.lead[0] : event.lead;
        const leadName = leadData?.name || 'Cliente';
        const eventTime = new Date(event.start_time).toLocaleTimeString('pt-PT', {
          hour: '2-digit',
          minute: '2-digit'
        });

        const notificationPayload = {
          organization_id: event.organization_id,
          title: `⏰ Lembrete: ${event.title}`,
          body: `Reunião com ${leadName} às ${eventTime}`,
          url: '/calendar'
        };

        console.log(`Sending reminder for event ${event.id}:`, notificationPayload);

        // Call send-push-notification function
        const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
          body: notificationPayload
        });

        if (pushError) {
          console.error(`Error sending push for event ${event.id}:`, pushError);
          results.push({ eventId: event.id, success: false, error: pushError.message });
        } else {
          // Mark reminder as sent
          const { error: updateError } = await supabase
            .from('calendar_events')
            .update({ reminder_sent: true })
            .eq('id', event.id);

          if (updateError) {
            console.error(`Error updating reminder_sent for event ${event.id}:`, updateError);
          }

          results.push({ eventId: event.id, success: true });
          console.log(`Reminder sent successfully for event ${event.id}`);
        }
      } catch (eventError) {
        console.error(`Error processing event ${event.id}:`, eventError);
        results.push({ eventId: event.id, success: false, error: String(eventError) });
      }
    }

    return new Response(
      JSON.stringify({
        checked: events?.length || 0,
        notified: eventsToNotify.length,
        results
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Error in check-reminders:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
