import {
  Apple,
  Wallet,
  HeartHandshake,
  Activity,
  HandHeart,
  Flower2,
  Bus,
} from "lucide-react";
export const services = [
  {
    slug: "nutrition",
    name: "Nutrition & everyday wellbeing",
    short: "Nutrition planning",
    icon: Apple,
    description:
      "Find meal programs, food support and qualified nutrition professionals that fit your everyday life.",
  },
  {
    slug: "financial",
    name: "Financial peace of mind",
    short: "Financial planning",
    icon: Wallet,
    description:
      "Connect with qualified financial professionals and resources to make sense of your next steps.",
  },
  {
    slug: "mental",
    name: "Emotional & mental wellbeing",
    short: "Mental health connections",
    icon: HeartHandshake,
    description:
      "Explore independent counselors, support groups and resources that help you feel connected.",
  },
  {
    slug: "physical",
    name: "Navigating healthcare",
    short: "Healthcare navigation",
    icon: Activity,
    description:
      "Understand available options and find external doctors, therapists and healthcare providers.",
  },
  {
    slug: "welfare",
    name: "Benefits & social support",
    short: "Social welfare services",
    icon: HandHeart,
    description:
      "Get help finding information on public benefits, housing support and community assistance.",
  },
  {
    slug: "planning",
    name: "Planning with dignity",
    short: "End-of-life planning",
    icon: Flower2,
    description:
      "Find trusted information and external legal, emotional and practical planning resources.",
  },
  {
    slug: "transportation",
    name: "Getting where you need to be",
    short: "Transportation coordination",
    icon: Bus,
    description:
      "Explore local transport options for appointments, essential errands and community connections.",
  },
];
export const resources = [
  {
    id: "first-conversation",
    category: "GETTING STARTED",
    title: "A little preparation. A clearer conversation.",
    description:
      "A simple checklist to help you gather your questions before speaking with a navigator.",
    color: "sage",
    read: "4 min read",
    content: [
      "Write down the one or two questions that matter most to you right now. You do not need to solve everything in one conversation.",
      "Make a list of the organizations or professionals you already work with. Keep any letters or forms nearby, but do not send sensitive documents until a secure process is agreed.",
      "Think about who you would like involved. You can ask a family member or trusted friend to join the conversation.",
      "At the end, ask what happens next, who will do what and when you should check in again.",
    ],
  },
  {
    id: "organize-paperwork",
    category: "PRACTICAL GUIDANCE",
    title: "Make room for less paperwork worry.",
    description:
      "Start a simple system for letters, appointments and questions, one folder at a time.",
    color: "peach",
    read: "3 min read",
    content: [
      "Choose one place for new letters and forms so they are easier to find.",
      "Sort papers by the organization that sent them. Keep a short list of dates that need your attention.",
      "Write down unfamiliar terms to ask about. A navigator can help locate clear information and appropriate professional support.",
      "Protect your information. Do not share identity numbers, financial documents or medical records through an ordinary contact form.",
    ],
  },
  {
    id: "support-network",
    category: "FOR FAMILIES",
    title: "You do not have to have every answer.",
    description:
      "A thoughtful starting point for building a circle of support around an older loved one.",
    color: "sand",
    read: "4 min read",
    content: [
      "Begin by asking your loved one what feels most important to them. Let their preferences guide the conversation.",
      "List everyday tasks that could use support, from transport to understanding a letter.",
      "Agree which family member or trusted person will help with each next step, with the older adult’s permission.",
      "Reach out for reliable information and independent professional guidance when a question goes beyond your experience.",
    ],
  },
];
