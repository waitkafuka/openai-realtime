const WebSocket = require('ws');
const express = require('express');
const http = require('http');
require('dotenv').config();

// 替换为您的apii.superx.chat的API密钥
const API_KEY = process.env.OPENAI_API_KEY;

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(clientWs) {
    console.log('客户端已连接');

    // 连接到apii.superx.chat
    const superxChatWs = new WebSocket('wss://apii.superx.chat/v1/realtime?model=gpt-4o-realtime-preview', {
        headers: {
            'Authorization': 'Bearer ' + API_KEY,
            'OpenAI-Beta': 'realtime=v1',
        },
    });

    superxChatWs.on('open', function () {
        console.log('已连接到apii.superx.chat');
        // 可以根据需要发送初始配置
        superxChatWs.send(JSON.stringify({
            type: 'response.create',
            response: {
                modalities: ["text", "audio"],
                instructions: "请协助用户。",
            }
        }));
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
              superxChatWs.send(JSON.stringify({type: 'response.create'}));
        }
    });

    clientWs.on('close', function () {
        console.log('客户端已断开连接');
        if (superxChatWs.readyState === WebSocket.OPEN) {
            superxChatWs.close();
        }
    });

    superxChatWs.on('message', function incoming(message) {
        try {
            const event = JSON.parse(message);
            console.log('收到消息:', event);
            
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

server.listen(3000, function () {
    console.log('服务器正在监听3000端口');
});