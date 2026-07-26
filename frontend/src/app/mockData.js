export const currentUser = {
  id: 'user-1',
  name: 'Elif Yilmaz',
  username: 'elifyilmaz',
  bio: 'Product-minded creator sharing social features, design notes, and everyday stories.',
  location: 'Istanbul, Turkiye',
  followers: 18420,
  following: 618,
  joinedAt: '2025-05-14',
  coverLabel: 'Urban sunset cover',
  avatarLabel: 'EY',
  isAuthenticated: true,
}

export const profiles = {
  elifyilmaz: currentUser,
  jonasmeyer: {
    id: 'user-2',
    name: 'Jonas Meyer',
    username: 'jonasmeyer',
    bio: 'Writes about creator communities, messaging UX, and product growth.',
    location: 'Berlin, Germany',
    followers: 9320,
    following: 404,
    joinedAt: '2025-02-02',
    coverLabel: 'Monochrome studio cover',
    avatarLabel: 'JM',
  },
}

export const trends = [
  '#CreatorEconomy',
  '#RealtimeUX',
  '#SocialDesign',
  '#WebPerformance',
]

export const friendSuggestions = [
  {
    id: 'friend-1',
    firstName: 'Aylin',
    lastName: 'Kara',
    fullName: 'Aylin Kara',
    username: 'aylinkara',
    mutualFriends: 12,
  },
  {
    id: 'friend-2',
    firstName: 'Mateo',
    lastName: 'Cruz',
    fullName: 'Mateo Cruz',
    username: 'mateocruz',
    mutualFriends: 8,
  },
  {
    id: 'friend-3',
    firstName: 'Lina',
    lastName: 'Weber',
    fullName: 'Lina Weber',
    username: 'linaweber',
    mutualFriends: 5,
  },
  {
    id: 'friend-4',
    firstName: 'Selin',
    lastName: 'Aydin',
    fullName: 'Selin Aydin',
    username: 'selinaydin',
    mutualFriends: 17,
  },
  {
    id: 'friend-5',
    firstName: 'Kerem',
    lastName: 'Demir',
    fullName: 'Kerem Demir',
    username: 'keremdemir',
    mutualFriends: 9,
  },
  {
    id: 'friend-6',
    firstName: 'Lara',
    lastName: 'Meyer',
    fullName: 'Lara Meyer',
    username: 'larameyer',
    mutualFriends: 6,
  },
]

export const posts = [
  {
    id: 'post-1',
    author: profiles.elifyilmaz,
    createdAt: '2h',
    content:
      'Building the first social feed shell today. Keeping the layout simple, readable, and fast on both web and mobile.',
    media: [{ type: 'image', label: 'Feed wireframe preview' }],
    likes: 182,
    comments: 29,
    saves: 14,
    shares: 8,
    commentThread: [
      {
        id: 'comment-1',
        author: 'Aylin Kara',
        handle: '@aylinkara',
        time: '48m',
        text: 'The right column balance feels clean already.',
        replies: [
          {
            id: 'comment-1-1',
            author: 'Elif Yilmaz',
            handle: '@elifyilmaz',
            time: '35m',
            text: 'Thank you. I want the main feed to stay the primary focus.',
            replies: [],
          },
        ],
      },
    ],
  },
  {
    id: 'post-2',
    author: profiles.jonasmeyer,
    createdAt: '5h',
    content:
      'Good messaging UIs are quiet. The content should carry the attention, not the chrome around it.',
    media: [],
    likes: 241,
    comments: 41,
    saves: 20,
    shares: 13,
    commentThread: [
      {
        id: 'comment-2',
        author: 'Mateo Cruz',
        handle: '@mateocruz',
        time: '2h',
        text: 'Completely agree, especially on mobile.',
        replies: [],
      },
    ],
  },
  {
    id: 'post-3',
    author: profiles.elifyilmaz,
    createdAt: '8h',
    content:
      'Drafting a 3-step signup flow: personal info, email verification, then password creation with strength feedback.',
    media: [{ type: 'image', label: 'Signup flow cards' }],
    likes: 119,
    comments: 18,
    saves: 11,
    shares: 4,
    commentThread: [],
  },
  {
    id: 'post-4',
    author: profiles.jonasmeyer,
    createdAt: '11h',
    content:
      'Nested comments should feel structured without getting visually noisy. Thin guide lines help a lot.',
    media: [],
    likes: 95,
    comments: 13,
    saves: 10,
    shares: 3,
    commentThread: [],
  },
  {
    id: 'post-5',
    author: profiles.elifyilmaz,
    createdAt: '1d',
    content:
      'Testing language routing with /en, /tr, /de, and /es while keeping canonical and alternate links consistent.',
    media: [{ type: 'video', label: 'Routing demo video' }],
    likes: 310,
    comments: 54,
    saves: 32,
    shares: 16,
    commentThread: [],
  },
  {
    id: 'post-6',
    author: profiles.jonasmeyer,
    createdAt: '1d',
    content:
      'A great sidebar should stay helpful when expanded and still feel elegant when collapsed.',
    media: [],
    likes: 144,
    comments: 17,
    saves: 8,
    shares: 6,
    commentThread: [],
  },
]

export const composerPreviewMedia = [
  { id: 'preview-1', type: 'image', label: 'Photo 1' },
  { id: 'preview-2', type: 'image', label: 'Photo 2' },
  { id: 'preview-3', type: 'image', label: 'Photo 3' },
  { id: 'preview-4', type: 'image', label: 'Photo 4' },
]

export const conversations = [
  {
    id: 'conv-1',
    name: 'Aylin Kara',
    username: 'aylinkara',
    snippet: 'The modal comment flow looks strong.',
    unread: 2,
    time: '12m',
    active: true,
  },
  {
    id: 'conv-2',
    name: 'Jonas Meyer',
    username: 'jonasmeyer',
    snippet: 'Let us keep the feed spacing airy.',
    unread: 0,
    time: '1h',
    active: false,
  },
  {
    id: 'conv-3',
    name: 'Mateo Cruz',
    username: 'mateocruz',
    snippet: 'I sent over the content notes.',
    unread: 0,
    time: '4h',
    active: false,
  },
]

export const activeChat = [
  {
    id: 'msg-1',
    sender: 'Aylin Kara',
    mine: false,
    content: 'Did you keep the sidebar open by default on desktop?',
    time: '14:08',
  },
  {
    id: 'msg-2',
    sender: 'Elif Yilmaz',
    mine: true,
    content: 'Yes. It starts at 240px and collapses to 80px.',
    time: '14:10',
    seen: true,
  },
  {
    id: 'msg-3',
    sender: 'Aylin Kara',
    mine: false,
    content: 'Perfect. The mobile bottom bar will help a lot too.',
    time: '14:11',
  },
]
