const WebSocket = require('ws');
const express = require('express');
const http = require('http');
require('dotenv').config();

// 添加一个全局变量来跟踪连接数
let connectionCount = 0;

// 替换为您的apii.superx.chat的API密钥

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// 添加一个新的 HTTP 端点来返回当前连接数
app.get('/connections', (req, res) => {
    res.json({ connections: connectionCount });
});

wss.on('connection', function connection(clientWs) {
    connectionCount++;
    console.log('客户端已连接', connectionCount);

    // 连接到apii.superx.chat
    const superxChatWs = new WebSocket(`ws://${process.env.API_BASE_HOST}/v1/realtime?model=gpt-4o-realtime-preview`, {
        headers: {
            'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
            'OpenAI-Beta': 'realtime=v1',
        },
    });

    superxChatWs.on('open', function () {
        console.log('已连接到apii.superx.chat');
        // 可以根据需要发送初始配置
        superxChatWs.send(JSON.stringify({
            type: 'session.update',
            session: {
                turn_detection: null,
            }
        }));
        // superxChatWs.send(JSON.stringify({
        //     type: 'response.create',
        //     response: {
        //         modalities: ["text", "audio"],
        //         instructions: "请协助用户。",
        //     }
        // }));
    });

    clientWs.on('message', function incoming(message) {
        const data = JSON.parse(message);
        if (data.type === 'audio') {
            // 发送input_audio_buffer.append消息给apii.superx.chat
            superxChatWs.send(JSON.stringify({
                type: 'input_audio_buffer.append',
                audio: data.audio
            }));
        } else if (data.type === 'audio_commit') {
            // 用户停止了录音，提交音频缓冲区并请求响应
            superxChatWs.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
            superxChatWs.send(JSON.stringify({
                type: 'response.create',
                response: {
                    modalities: ["text", "audio"],
                    instructions: "请协助用户。",
                }
            }));
        } else if (data.type === 'text') {
            const event = {
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: data.content
                        }
                    ]
                }
            };
            superxChatWs.send(JSON.stringify(event));
            superxChatWs.send(JSON.stringify({ type: 'response.create' }));
        } else if (data.type === 'response.cancel') {
            // 转发 response.cancel 事件给 apii.superx.chat
            superxChatWs.send(JSON.stringify({ type: 'response.cancel' }));
            console.log('Sent response.cancel to apii.superx.chat');
        }
    });

    clientWs.on('close', function () {
        // 减少连接计数
        connectionCount--;
        console.log('客户端已断开连接', connectionCount);
        if (superxChatWs.readyState === WebSocket.OPEN) {
            superxChatWs.close();
        }
    });

    superxChatWs.on('message', function incoming(message) {
        try {
            const event = JSON.parse(message);
            //复制一个event用来打印日志，但是event.delta 太长了，打印的时候，如果截取event.delta的前100个字符。但是不要改变event.delta的值
            const eventForLog = JSON.parse(JSON.stringify(event));
            if (eventForLog.delta) {
                eventForLog.delta = eventForLog.delta.slice(0, 100);
            }
            console.log('收到消息:', eventForLog);

            if (event.type === 'response.audio.delta') {
                const audioData = event.delta; // Base64编码的音频数据
                // 发送音频数据给客户端
                clientWs.send(JSON.stringify({ type: 'audio', audio: audioData }));
            } else if (event.type === 'response.audio.done') {
                // 音频发送完成
                console.log('音频发送完成');
            } else if (event.type === 'error') {
                // 处理错误
                console.error('apii.superx.chat 错误:', event.error);
                clientWs.send(JSON.stringify({ type: 'error', message: event.error.message }));
            } else if (event.type === 'response.audio_transcript.delta') {
                const textData = event.delta; // 文本数据
                // 发送文本数据给客户端
                clientWs.send(JSON.stringify({ type: 'text', content: textData }));
            } else if (event.type === 'response.audio_transcript.done') {
                console.log('音频转文字完成');
                clientWs.send(JSON.stringify({ type: 'response.audio_transcript.done', content: '音频转文字完成' }));
            }
            // 可以根据需要处理其他事件类型
        } catch (error) {
            console.error('处理 apii.superx.chat 消息时出错:', error);
            clientWs.send(JSON.stringify({ type: 'error', message: '服务器处理消息时出错' }));
        }
    });

    superxChatWs.on('close', function () {
        console.log('与apii.superx.chat的连接已断开');
    });

    superxChatWs.on('error', function (error) {
        console.error('apii.superx.chat连接错误：', error);
    });
});

server.listen(3008, function () {
    console.log('服务器正在监听3008端口');
});
