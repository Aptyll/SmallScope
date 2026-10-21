# js/ui/roomtalk.js

| Looking for | Start at | Banner |
| --- | --- | --- |
| the room's chat (and the champ select's, bottom left, your side's only while the draft is on): cleaning, keeping and handing lines round, typing one, the plate and the lines | `TALK_*`, `talkClean`, `talkAdd`, `talkHeard`, `talkFrom`, `talkSay`, `talkKey`, `talkOpen`, `talkLayout`, `inTalk`, `drawTalk`, `NET.chat` | `room talk` |
| INVITE in a Steam lobby, and a friend's invite taken up | `roomInviteRect`, `roomInvite`, `steamJoinRequested` (the launch's `+connect_lobby`: desktop/main.js) | `invite` |
| the nudge: a taskbar flash or a starred tab title when a screen out of focus is needed | `roomAttention`, `talkTitle` (the wrapper's `win:flash`, desktop/main.js) | `the nudge` |
