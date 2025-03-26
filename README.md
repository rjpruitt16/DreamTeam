# Multi-Agentic Discord Bot

This project is designed as an engaging, hands-on learning experience showcasing how multiple intelligent agents collaborate within a single application framework. Feel free to fork or modify this project as long as you do not sell it commercially.

## 🎯 Project Goals

- Enable interactive conversations with a Discord bot that understands and engages with members.
- Dynamically interact with various APIs.
- Have fun experimenting with AI-driven interactions!

## 🚀 Agent Overview

### 🎙️ Mouthpiece (Node.js + Discord.js)

Responsible for real-time voice interactions with Discord clients.

**Why Node.js?** Python’s real-time voice support for Discord is challenging; Node.js makes life simpler—for now!

### 👻 Ghostwriter (Python + LangChain + OpenAI)

### 🧠 Voice Agent
Serves as the primary intelligence behind the bot, managing streaming input/output via gRPC.

**Capabilities:**
- Handles real-time voice interactions through OpenAI's voice agent API.
- Interacts seamlessly with other agents to execute tasks.

**Long-term Vision:**
- Real-time intuitive conversations.
- Potentially coordinates with DM Agent for confirmations.
- Stores valuable conversational context through Memory Agent.

### 🧠 Memory Agent

Stores user and Discord group data effectively using ChromaDB or OpenAI's storage solutions.

**Interactions:**
- Coordinates with the Critic Agent to ensure appropriate data handling.

**Long-term Vision:**
- Develops nuanced profiles of users, tracking personalities, daily routines, goals, and habits.

### 💬 DM Agent

Engages directly with users through direct messages, facilitating communication for other agents.

**Interactions:**
- Confirms sensitive data operations with the Critic Agent before saving information.

**Long-term Vision:**
- Actively curious and consistently learns about users to enhance interactions.

### 🌐 Web Search Agent

Performs real-time web searches to answer questions and fetch information dynamically.

### 🖥️ Computer Use Agent

Dynamically interacts with external APIs, simplifying complex integrations.

**Long-term Vision:**
- Make API interactions as effortless and user-friendly as possible.

### 🛡️ Critic Agent

Ensures the privacy and appropriate handling of user data.

**Long-term Vision:**
- Provide transparent, reliable privacy management to build user trust.

## 📖 License

This project is available for educational and personal use. Modification and forking are encouraged; commercial sale of the codebase or derivatives is strictly prohibited.

## 🌟 Have fun exploring and collaborating!

