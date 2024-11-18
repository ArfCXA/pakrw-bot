require('dotenv').config(); 
const { Client, GatewayIntentBits, ActivityType, MessageAttachment, MessageActionRow, MessageButton, MessageEmbed } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const { Configuration, OpenAIApi } = require('openai');
const express = require('express');
const path = require('path');
const fs = require('fs');

// Konfigurasi API OpenAI
const openaiConfig = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(openaiConfig);

// Token Bot Discord
const TOKEN = process.env.DISCORD_TOKEN;

// Konfigurasi Bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.MessageContent,
    ],
});

// Channel yang diizinkan untuk autoresponder
const ALLOWED_CHANNELS = [
    '1052124921817464883', // ID Channel Bot
    '1052123058678276106', // ID Channel Chat Warga
    `1307965374511190068`, // ID Channel Tanya Pak RW
    '1307961992346206238', // ID Channel Couple Generator
];

// Prefix
const PREFIX = 'rw';
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// Konfigurasi Express untuk menangani port
const app = express();
const PORT = process.env.PORT || 3000;

// Routing dasar untuk memastikan aplikasi web berjalan
app.get('/', (req, res) => {
    const filePath = path.join(__dirname, 'index.html');
    res.sendFile(filePath);
});

app.listen(PORT, () => {
    console.log(`Server Express berjalan di port ${PORT}`);
});

// Untuk menyimpan status player
let player;
let connection;

// Fungsi untuk memutar audio di voice channel
async function playAudio(channel) {
    try {
        const audioPath = path.join(__dirname, 'audio', 'desa.mp3');
        // Bergabung ke voice channel
        connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
        });

        // Membuat player
        player = createAudioPlayer();
        connection.subscribe(player);

        const playResource = () => {
            const resource = createAudioResource(audioPath, {
                inlineVolume: true,
            });
            resource.volume.setVolume(0.075); // Atur volume ke 7.5%
            player.play(resource);
        };
        // Mulai pemutaran audio
        playResource();

        player.on(AudioPlayerStatus.Idle, () => {
            console.log('Audio selesai, memulai ulang...');
            playResource(); // Ulangi pemutaran audio
        });

        player.on('error', (error) => {
            console.error('Kesalahan pada audio player:', error);
        });

        connection.on('error', (error) => {
            console.error('Kesalahan pada koneksi voice channel:', error);
        });

        console.log('Audio sedang diputar di voice channel.');
    } catch (error) {
        console.error('Gagal memutar audio:', error);
    }
}

// Bot Siap
client.once('ready', async () => {
    console.log(`${client.user.tag} is online and ready!`);
});

// Menambahkan custom status
const statusMessages = ["👀 Sedang Memantau", "👥 Warga Gang Desa"];
const statusTypes = [ 'dnd', 'idle'];
let currentStatusIndex = 0;
let currentTypeIndex = 0;

async function login() {
  try {
    await client.login(process.env.TOKEN);
    console.log('\x1b[36m[ LOGIN ]\x1b[0m', `\x1b[32mLogged in as: ${client.user.tag} ✅\x1b[0m`);
    console.log('\x1b[36m[ INFO ]\x1b[0m', `\x1b[35mBot ID: ${client.user.id} \x1b[0m`);
    console.log('\x1b[36m[ INFO ]\x1b[0m', `\x1b[34mConnected to ${client.guilds.cache.size} server(s) \x1b[0m`);
  } catch (error) {
    console.error('\x1b[31m[ ERROR ]\x1b[0m', 'Failed to log in:', error);
    process.exit(1);
  }
}

function updateStatus() {
  const currentStatus = statusMessages[currentStatusIndex];
  const currentType = statusTypes[currentTypeIndex];
  client.user.setPresence({
    activities: [{ name: currentStatus, type: ActivityType.Custom }],
    status: currentType,
  });
  console.log('\x1b[33m[ STATUS ]\x1b[0m', `Updated status to: ${currentStatus} (${currentType})`);
  currentStatusIndex = (currentStatusIndex + 1) % statusMessages.length;
  currentTypeIndex = (currentTypeIndex + 1) % statusTypes.length;
}

function heartbeat() {
  setInterval(() => {
    console.log('\x1b[35m[ HEARTBEAT ]\x1b[0m', `Bot is alive at ${new Date().toLocaleTimeString()}`);
  }, 30000);
}

client.once('ready', () => {
  console.log('\x1b[36m[ INFO ]\x1b[0m', `\x1b[34mPing: ${client.ws.ping} ms \x1b[0m`);
  updateStatus();
  setInterval(updateStatus, 10000);
  heartbeat();
});

// Respons Otomatis dan Logging
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Cek jika channel termasuk dalam daftar channel yang diizinkan
    if (!ALLOWED_CHANNELS.includes(message.channel.id)) return;

    // Logging penggunaan perintah
    const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
    if (logChannel && message.content.startsWith(PREFIX)) {
        logChannel.send(`[LOG] ${message.author.tag} menggunakan perintah: ${message.content}`);
    }

    // Perintah untuk bergabung ke voice channel dan memutar audio
    if (message.content.startsWith(`${PREFIX}join`)) {
        const voiceChannel = message.member.voice.channel;

        if (!voiceChannel) {
            message.reply('Anda harus berada di voice channel untuk menggunakan perintah ini.');
            return;
        }

        await playAudio(voiceChannel);
        message.reply('Pak RW telah bergabung ke channel.');
    }

    // Perintah untuk keluar dari voice channel
    if (message.content.startsWith(`${PREFIX}leave`)) {
        if (connection) {
            connection.destroy();
            connection = null;
            player = null;
            message.reply('Pak RW telah keluar dari voice channel.');
        } else {
            message.reply('Pak RW tidak berada di voice channel.');
        }
    }

    // Respons otomatis untuk kata kunci
    const lowerContent = message.content.toLowerCase();

    if (lowerContent.includes('welcome')) {
        message.reply('Selamat datang warga baru! Semoga betah jadi warga di sini, join voice sini biar makin akrab. <:OkeSip:1291831721313964053>');
    } else if (lowerContent.includes('halo')) {
        message.reply('Halo juga kak! Gabung sini ke voice biar makin akrab hehe <:Hehe:1099424821974151310>');
    } else if (lowerContent.includes('mabar')) {
        message.reply('Buat yang mau mabar bisa cari di https://discord.com/channels/1052115524273836176/1052428628819984424 ya jangan lupa tag role game yang mau dimainin <:OkeSip:1291831721313964053>');
    } else if (lowerContent.includes('salam kenal')) {
        message.reply('Salam kenal juga kak! Dengan kakak siapa nich? <:Halo:1291831692025397270>');
    } else if (lowerContent.includes('donasi')) {
        message.reply('Kalau mau jadi donatur server bisa cek https://discord.com/channels/1052115524273836176/1221385772351881286 yaaa <:Wink:1099424794350473216>');
    } else if (lowerContent.includes('jodoh')) {
        message.reply('Buat yang mau cari jodoh bisa langsung aja ke <#1284544825596837971> <:Love:1291831704171970612>');
    } else if (lowerContent.includes('pagi')) {
        message.reply('Selamat pagi juga kak! Kamu tuh kaya alarm, suka bangunin hati aku biar terus inget kamu. <:Kiss:1099424790474915912>');
    } else if (lowerContent.includes('siang')) {
        message.reply('Selamat siang juga kak! Siang ini panas, tapi cuma kamu yang bikin hati aku meleleh. Kirim papnya dong di <#1100632084051140669> hehe <:Uwu:1291831737609097338>');
    } else if (lowerContent.includes('sore')) {
        message.reply('Selamat sore juga kak! Matahari boleh tenggelam, tapi rasa sayang aku ke kamu nggak pernah hilang <:Uwu:1291831737609097338>');
    } else if (lowerContent.includes('malam')) {
        message.reply('Selamat malam juga kak! Aku ada pantun nih buat kamu.\n\nMentari terbenam di tepi pantai,\nOmbak datang menyapa riang.\nMalam ini hati terasa damai,\n Karena kamu selalu di pikiranku sayang.\n\nAnjayyy gombal <:Love:1291831704171970612>');
    }

   // Fitur "Cari Jodoh"
client.on('messageCreate', async (message) => {
    // Perintah untuk memulai form
    if (message.content === 'rwjodoh') {
        // Membuat tombol untuk memulai form
        const row = new MessageActionRow().addComponents(
            new MessageButton()
                .setCustomId('start_form')
                .setLabel('Isi Form Cari Jodoh')
                .setStyle('PRIMARY')
        );

        // Kirim pesan dengan tombol
        await message.channel.send({
            content: 'Klik tombol di bawah untuk mengisi form Cari Jodoh!',
            components: [row]
        });
    }
});

// Menangani tombol yang ditekan
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'start_form') {
        // Mengirimkan pertanyaan untuk form
        await interaction.reply('Silakan isi form berikut:');

        // Membuat embed untuk meminta input
        const embed = new MessageEmbed()
            .setColor('#ff69b4')
            .setTitle('Form Cari Jodoh')
            .setDescription('Mohon isi data diri berikut (Balas dengan jawaban yang sesuai):')
            .addFields(
                { name: 'Nama:', value: 'Tulis Nama Kamu' },
                { name: 'Umur:', value: 'Tulis Umur Kamu' },
                { name: 'Jenis Kelamin:', value: 'Tulis Jenis Kelamin Kamu' },
                { name: 'Agama:', value: 'Tulis Agama Kamu' },
                { name: 'Domisili:', value: 'Tulis Domisili Kamu' },
                { name: 'Kesibukan:', value: 'Tulis Kesibukan Kamu' },
                { name: 'Hobi:', value: 'Tulis Hobi Kamu' },
                { name: 'Tipe Ideal:', value: 'Tulis Tipe Ideal Kamu' }
            );

        await interaction.followUp({ embeds: [embed] });

        // Menunggu pesan balasan dari user
        const filter = (response) => response.author.id === interaction.user.id;
        const collected = await interaction.channel.awaitMessages({
            filter,
            max: 1,
            time: 60000,
            errors: ['time'],
        });

        const userResponse = collected.first();

        // Ambil data dari balasan
        const formData = userResponse.content.split('\n'); // Memisahkan data yang dipisahkan dengan enter

        // Membuat embed hasil form
        const resultEmbed = new MessageEmbed()
            .setColor('#ff69b4')
            .setTitle('Hasil Form Cari Jodoh')
            .setDescription(`Berikut adalah data yang kamu isi:`)
            .addFields(
                { name: 'Nama:', value: formData[0] || 'Tidak Diisi' },
                { name: 'Umur:', value: formData[1] || 'Tidak Diisi' },
                { name: 'Jenis Kelamin:', value: formData[2] || 'Tidak Diisi' },
                { name: 'Agama:', value: formData[3] || 'Tidak Diisi' },
                { name: 'Domisili:', value: formData[4] || 'Tidak Diisi' },
                { name: 'Kesibukan:', value: formData[5] || 'Tidak Diisi' },
                { name: 'Hobi:', value: formData[6] || 'Tidak Diisi' },
                { name: 'Tipe Ideal:', value: formData[7] || 'Tidak Diisi' }
            )
            .setThumbnail(interaction.user.displayAvatarURL()) // Menampilkan foto profil pengguna
            .setFooter(`Dikirim oleh: ${interaction.user.tag}`);

        // Kirim hasil embed
        await interaction.followUp({
            content: `@${interaction.user.tag}, berikut adalah hasil dari form yang kamu isi:`,
            embeds: [resultEmbed]
        });

        // Tambahkan reaksi love otomatis
        const resultMessage = await interaction.channel.messages.fetch({ limit: 1 });
        resultMessage.first().react('❤️');
    }
});

    // Path folder gambar lokal
    const girlsFolder = path.join(__dirname, 'couple_images', 'girls');
    const boysFolder = path.join(__dirname, 'couple_images', 'boys');

    // Perintah untuk mengirim gambar pasangan
    if (message.content.startsWith(`${PREFIX}couple`)) {
        try {
            const girlFiles = fs.readdirSync(girlsFolder);
            const boyFiles = fs.readdirSync(boysFolder);

            if (girlFiles.length !== boyFiles.length) {
                await message.channel.send('Jumlah gambar cewek dan cowok tidak sama! Periksa folder pasangan.');
                return;
            }

            girlFiles.sort();
            boyFiles.sort();

            const randomIndex = Math.floor(Math.random() * girlFiles.length);
            const girlImagePath = path.join(girlsFolder, girlFiles[randomIndex]);
            const boyImagePath = path.join(boysFolder, boyFiles[randomIndex]);

            await message.reply({
                content: `👩‍❤️‍👨 **Ini Photo Profile Couple buat kamu!**`,
                files: [girlImagePath, boyImagePath],
            });
        } catch (error) {
            console.error('Terjadi kesalahan saat mengirim gambar:', error);
            await message.channel.send('Maaf, terjadi kesalahan saat mencoba mengirim gambar.');
        }
    }

    // Perintah untuk ngobrol dengan ChatGPT
    if (message.content.startsWith(`${PREFIX}tanya`)) {
        const query = message.content.slice(`${PREFIX}tanya`.length).trim();
        if (!query) {
            message.reply('Tanyain aja, nanti Pak RW jawab');
            return;
        }

        try {
            const response = await openai.createChatCompletion({
                model: 'gpt-3.5-turbo', 
                messages: [
                    {
                        role: 'user',
                        content: query,
                    },
                ],
            });

            const reply = response.data.choices[0].message.content.trim();
            message.reply(reply);
        } catch (error) {
            console.error('Error with OpenAI API:', error);
            message.reply('Maaf, Pak RW lagi bingung nih sama pertanyaannya');
        }
    }
});

// Login ke bot
client.login(TOKEN);
