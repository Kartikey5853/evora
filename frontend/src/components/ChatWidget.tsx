import { useState, useEffect, useRef } from "react"
import {
  MessageCircle,
  X,
  Send,
  Bot,
  ChevronLeft,
  Building2,
  User as UserIcon,
} from "lucide-react"
import { messageAPI } from "@/lib/api"

interface StationForChat {
  station_id: string
  station_name: string
  station_address: string
  host_id: string
  host_name: string
  message_count: number
}

interface AdminThread {
  station_id: string
  station_name: string
  user_id: string
  user_name: string
  last_message: string
  last_message_at: string
  message_count: number
}

interface ChatMessage {
  id: string
  sender_id: string
  sender_role: string
  receiver_id: string
  receiver_role: string
  booking_id: string | null
  station_id: string | null
  content: string
  created_at: string
}

type Tab = "ai" | "messages"
type View = "tabs" | "list" | "chat"

const ChatWidget = ({ userType = "user" }: { userType?: "user" | "admin" }) => {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("messages")
  const [view, setView] = useState<View>("tabs")

  // User: stations to chat with
  const [stations, setStations] = useState<StationForChat[]>([])
  // Admin: threads grouped by station+user
  const [adminThreads, setAdminThreads] = useState<AdminThread[]>([])
  const [loadingList, setLoadingList] = useState(false)

  // Active chat state
  const [activeStationId, setActiveStationId] = useState<string | null>(null)
  const [activeReceiverId, setActiveReceiverId] = useState<string | null>(null)
  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  const [activeChatTitle, setActiveChatTitle] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messageInput, setMessageInput] = useState("")
  const [sending, setSending] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const currentUserId = useRef<string>("")

  useEffect(() => {
    try {
      const token = localStorage.getItem("access_token")
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]))
        currentUserId.current = payload.user_id || payload.admin_id || ""
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!open || tab !== "messages") return
    fetchList()
  }, [open, tab])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (view !== "chat" || !activeStationId) return
    const interval = setInterval(() => { loadMessages() }, 5000)
    return () => clearInterval(interval)
  }, [view, activeStationId, activeUserId])

  const fetchList = async () => {
    setLoadingList(true)
    try {
      if (userType === "user") {
        const res = await messageAPI.getUserStationsForChat()
        setStations(res.data || [])
      } else {
        const res = await messageAPI.getAdminStationThreads()
        setAdminThreads(res.data || [])
      }
    } catch {}
    finally { setLoadingList(false) }
  }

  const loadMessages = async () => {
    if (!activeStationId) return
    try {
      if (userType === "admin" && activeUserId) {
        const res = await messageAPI.getStationUserMessages(activeStationId, activeUserId)
        setMessages(res.data || [])
      } else {
        const res = await messageAPI.getByStation(activeStationId)
        const filtered = (res.data || []).filter(
          (m: ChatMessage) => m.sender_id === currentUserId.current || m.receiver_id === currentUserId.current
        )
        setMessages(filtered)
      }
    } catch {}
  }

  const openStationChat = async (stationId: string, receiverId: string, title: string, userId?: string) => {
    setActiveStationId(stationId)
    setActiveReceiverId(receiverId)
    setActiveUserId(userId || null)
    setActiveChatTitle(title)
    setView("chat")
    setLoadingMessages(true)
    try {
      if (userType === "admin" && userId) {
        const res = await messageAPI.getStationUserMessages(stationId, userId)
        setMessages(res.data || [])
      } else {
        const res = await messageAPI.getByStation(stationId)
        const filtered = (res.data || []).filter(
          (m: ChatMessage) => m.sender_id === currentUserId.current || m.receiver_id === currentUserId.current
        )
        setMessages(filtered)
      }
    } catch {}
    finally { setLoadingMessages(false) }
  }

  const sendMessage = async () => {
    if (!messageInput.trim() || !activeReceiverId || !activeStationId) return
    setSending(true)
    try {
      const data = {
        receiver_id: activeReceiverId,
        receiver_role: userType === "user" ? "admin" : "user",
        station_id: activeStationId,
        content: messageInput.trim(),
      }
      const res = userType === "user"
        ? await messageAPI.sendAsUser(data)
        : await messageAPI.sendAsAdmin(data)
      setMessages((prev) => [...prev, res.data])
      setMessageInput("")
    } catch (err: any) {
      alert(err?.response?.data?.detail || "Failed to send")
    } finally { setSending(false) }
  }

  const formatTime = (iso: string) => {
    try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }
    catch { return "" }
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setView("tabs") }}
        className="fixed bottom-24 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition flex items-center justify-center"
        title="Chat & Help"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    )
  }

  return (    <div className="fixed bottom-24 right-6 z-50 w-[360px] h-[520px] rounded-2xl border bg-card shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          {view === "chat" && (
            <button
              onClick={() => { setView("list"); setActiveStationId(null); setActiveUserId(null) }}
              className="hover:bg-white/20 rounded p-0.5"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <MessageCircle className="w-5 h-5" />
          <span className="font-semibold text-sm truncate">
            {view === "chat" ? activeChatTitle : "Help & Messages"}
          </span>
        </div>
        <button onClick={() => setOpen(false)} className="hover:bg-white/20 rounded p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tab bar */}
      {view !== "chat" && (
        <div className="flex border-b">
          <button
            onClick={() => { setTab("ai"); setView("tabs") }}            className={`flex-1 py-2.5 text-xs font-medium transition ${
              tab === "ai" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bot className="w-4 h-4 inline mr-1" />AI Help
          </button>
          <button
            onClick={() => { setTab("messages"); setView("list") }}            className={`flex-1 py-2.5 text-xs font-medium transition ${
              tab === "messages" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageCircle className="w-4 h-4 inline mr-1" />Messages
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* AI Help placeholder */}
        {tab === "ai" && view === "tabs" && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <Bot className="w-12 h-12 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">AI Assistant</p>
            <p className="text-sm text-muted-foreground mt-1">Coming soon! AI-powered help for finding chargers, booking assistance, and troubleshooting.</p>
          </div>
        )}

        {/* USER: Station list */}
        {tab === "messages" && view === "list" && userType === "user" && (
          <div className="p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground px-1 mb-2">Select a station to message</p>
            {loadingList ? (
              <p className="text-xs text-muted-foreground text-center py-8">Loading stations…</p>
            ) : stations.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No stations available</p>
              </div>
            ) : (
              stations.map((s) => (
                <button
                  key={s.station_id}
                  onClick={() => openStationChat(s.station_id, s.host_id, s.station_name)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition flex items-start gap-3"
                >                  <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{s.station_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{s.station_address}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                      Host: {s.host_name}{s.message_count > 0 && ` • ${s.message_count} messages`}
                    </p>
                  </div>
                  {s.message_count > 0 && (
                    <span className="bg-accent text-primary text-[10px] font-medium px-1.5 py-0.5 rounded-full">{s.message_count}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {/* ADMIN: Incoming message threads */}
        {tab === "messages" && view === "list" && userType === "admin" && (
          <div className="p-3 space-y-2">
            <p className="text-xs font-medium text-muted-foreground px-1 mb-2">Incoming messages from users</p>
            {loadingList ? (
              <p className="text-xs text-muted-foreground text-center py-8">Loading…</p>
            ) : adminThreads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No messages yet</p>
                <p className="text-xs mt-1">Messages from users will appear here</p>
              </div>
            ) : (
              adminThreads.map((t, i) => (
                <button
                  key={i}
                  onClick={() => openStationChat(t.station_id, t.user_id, `${t.user_name} @ ${t.station_name}`, t.user_id)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-accent/50 transition flex items-start gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{t.user_name}</p>
                    <p className="text-[11px] text-muted-foreground">{t.station_name}</p>
                    <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{t.last_message}</p>
                  </div>
                  <span className="bg-blue-100 text-blue-700 text-[10px] font-medium px-1.5 py-0.5 rounded-full">{t.message_count}</span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Chat view */}
        {view === "chat" && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loadingMessages ? (
                <p className="text-xs text-muted-foreground text-center py-8">Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No messages yet. Say hello! 👋</p>
              ) : (
                messages.map((m) => {
                  const isMine = m.sender_id === currentUserId.current
                  return (
                    <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>                      <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                        isMine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"
                      }`}>
                        <p>{m.content}</p>
                        <p className={`text-[9px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>{formatTime(m.created_at)}</p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Message input */}
      {view === "chat" && (
        <div className="p-3 border-t flex gap-2">
          <input
            type="text"
            placeholder="Type a message…"
            className="flex-1 px-3 py-2 border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          />
          <button
            onClick={sendMessage}
            disabled={!messageInput.trim() || sending}
            className="px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

export default ChatWidget
