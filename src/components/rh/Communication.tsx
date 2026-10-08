import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { text } from "@/lib/rh/schema";
import type { RhSnapshot, RhRecord } from "@/lib/rh/schema";
import type { useRhWorkspace } from "@/hooks/useRhWorkspace";
import { NotificationSettings } from "./NotificationSettings";
import { CommunicationComposer } from "./CommunicationComposer";
import { ConfigRecords } from "./ConfigRecords";
import { ListPager } from "./ListPager";

export function Communication({data,workspace}: {
  readonly data: RhSnapshot; readonly workspace: ReturnType<typeof useRhWorkspace>;
}) {
  const [tab,setTab] = useState("wall");
  const [page,setPage] = useState(1);
  const [mode,setMode] = useState<"notice" | "group" | null>(null);
  const [reading,setReading] = useState<RhRecord>();
  const manager = data.permissions["communication.manage"];
  const notices = [...data.records.filter(r => r.kind === "notice")].sort((a,b) => b.created_at.localeCompare(a.created_at));
  const groups = data.records.filter(r => r.kind === "group");
  const notifications = data.notifications.filter(n => n.user_id === workspace.userId);
  return <Tabs value={tab} onValueChange={value => {setTab(value);setPage(1);}} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <TabsList className="h-auto flex-wrap"><TabsTrigger value="wall">Mural</TabsTrigger><TabsTrigger value="notifications">Notificações</TabsTrigger>{manager && <TabsTrigger value="settings">Configuração</TabsTrigger>}</TabsList>
      {manager && tab === "wall" && <Button onClick={() => setMode("notice")}>Publicar aviso</Button>}
    </div>
    <TabsContent value="wall"><Card><CardHeader><CardTitle>Avisos da equipa</CardTitle></CardHeader><CardContent className="space-y-3">
      {notices.slice((page-1)*6,page*6).map(r => <article key={r.id} className="rounded-lg border p-4">
        <h3 className="font-semibold">{text(r.data,"title")}</h3><p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm">{text(r.data,"body")}</p>
        <div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("pt-PT")}</span><Button size="sm" variant="outline" onClick={() => setReading(r)}>Ler aviso</Button></div>
      </article>)}
      {!notices.length && <p className="text-sm text-muted-foreground">Sem avisos.</p>}
      <ListPager page={page} total={notices.length} size={6} onChange={setPage}/>
    </CardContent></Card></TabsContent>
    <TabsContent value="notifications"><Card><CardHeader><CardTitle>As minhas notificações</CardTitle></CardHeader><CardContent className="space-y-3">
      {notifications.slice((page-1)*8,page*8).map(n => <div key={n.id} className="rounded-lg border p-3"><p>{text(n.payload,"title")}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(n.due_at).toLocaleString("pt-PT")} · {({queued:"Agendado",delivered:"Disponível",uncertain:"Envio por confirmar",processing:"A processar",failed:"Falhou"} satisfies Record<string,string>)[n.state] ?? n.state}</p></div>)}
      {!notifications.length && <p className="text-sm text-muted-foreground">Sem notificações.</p>}
      <ListPager page={page} total={notifications.length} size={8} onChange={setPage}/>
    </CardContent></Card></TabsContent>
    {manager && <TabsContent value="settings"><Tabs defaultValue="groups" onValueChange={() => setPage(1)} className="space-y-4"><TabsList className="h-auto w-full flex-wrap justify-start"><TabsTrigger value="groups">Grupos</TabsTrigger><TabsTrigger value="delivery">Notificações e destinatários</TabsTrigger><TabsTrigger value="notices">Gerir avisos</TabsTrigger></TabsList>
      <TabsContent value="groups"><Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Grupos RH</CardTitle><Button onClick={() => setMode("group")}>Criar grupo</Button></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">Os grupos definem quem recebe avisos. As permissões continuam nos perfis do P2G.</p><ConfigRecords records={groups.slice((page-1)*8,page*8)} data={data} workspace={workspace}/><ListPager page={page} total={groups.length} size={8} onChange={setPage}/></CardContent></Card></TabsContent>
      <TabsContent value="delivery"><NotificationSettings data={data} workspace={workspace}/></TabsContent>
      <TabsContent value="notices"><ConfigRecords records={notices.slice((page-1)*8,page*8)} data={data} workspace={workspace}/><ListPager page={page} total={notices.length} size={8} onChange={setPage}/></TabsContent>
    </Tabs></TabsContent>}
    {manager && <CommunicationComposer data={data} workspace={workspace} mode={mode} onClose={() => setMode(null)}/>}
    <Dialog open={!!reading} onOpenChange={open => {if(!open)setReading(undefined);}}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{reading ? text(reading.data,"title") : "Aviso"}</DialogTitle><DialogDescription>{reading ? new Date(reading.created_at).toLocaleDateString("pt-PT") : ""}</DialogDescription></DialogHeader><p className="whitespace-pre-wrap break-words text-sm">{reading ? text(reading.data,"body") : ""}</p></DialogContent></Dialog>
  </Tabs>;
}
