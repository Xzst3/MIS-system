export const serviceDetails: Record<
  string,
  { image: string; alt: string; steps: string[]; example: string }
> = {
  nutrition: {
    image: "nutrition",
    alt: "An older woman discussing meal information with a navigator",
    steps: [
      "Explore community meals and food support.",
      "Prepare questions for an independent nutrition professional.",
      "Coordinate a useful next step and follow up.",
    ],
    example:
      "You want to understand the meal programmes available near you. We help you compare information and connect with the right provider.",
  },
  financial: {
    image: "financial",
    alt: "An older man and a navigator organizing everyday financial paperwork",
    steps: [
      "Make a manageable list of questions and paperwork.",
      "Find information about available support.",
      "Connect with independent qualified financial professionals.",
    ],
    example:
      "A letter about your finances feels confusing. We help organize the questions to bring to an appropriate professional.",
  },
  mental: {
    image: "wellbeing",
    alt: "An older adult and a navigator sharing a conversation in a garden",
    steps: [
      "Listen to what connection and wellbeing mean to you.",
      "Explore community groups and independent support.",
      "Help arrange an introduction or appointment.",
    ],
    example:
      "You would like more social connection or someone to talk to. We help you discover suitable groups and external support.",
  },
  physical: {
    image: "healthcare",
    alt: "A navigator and an older adult reviewing appointment information",
    steps: [
      "Understand the options and information available.",
      "Prepare for an appointment with an external provider.",
      "Coordinate practical next steps and transport needs.",
    ],
    example:
      "You have an appointment but are unsure what to prepare. We help organize the practical details and questions.",
  },
  welfare: {
    image: "welfare",
    alt: "An older woman reviewing benefits information with a community navigator",
    steps: [
      "Identify benefits and community information to explore.",
      "Break application steps into smaller tasks.",
      "Connect you with the appropriate agency or organization.",
    ],
    example:
      "You want to find out which community support may be available. We help locate information and clarify the next step.",
  },
  planning: {
    image: "planning",
    alt: "An older couple discussing later-life wishes with a navigator",
    steps: [
      "Make space for your priorities and preferences.",
      "Find reliable planning checklists and information.",
      "Connect with independent legal and other professionals.",
    ],
    example:
      "You would like to start a conversation about future wishes. We help you prepare and find appropriate independent guidance.",
  },
  transportation: {
    image: "transport",
    alt: "An older adult and volunteer preparing for transport accompaniment",
    steps: [
      "Discuss the journey and any access needs.",
      "Coordinate transport and accompaniment where available.",
      "Plan arrival, waiting and the journey home.",
    ],
    example:
      "Getting to an appointment is difficult. We help explore transport, accompaniment and return arrangements.",
  },
};
