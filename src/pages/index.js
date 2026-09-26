import {
  Box,
  Container,
  Flex,
  Grid,
  Heading,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import Head from "next/head";

const services = [
  {
    name: "Gépi hajvágás",
    description: "30 perc",
    price: "5 500",
  },
  {
    name: "Haj és szakáll",
    description: "1 óra",
    price: "8 000",
  },
  {
    name: "Hajvágás",
    description: "30 perc",
    price: "6 000",
  },
];

const gallery = [
  {
    src: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=1600&q=90",
    position: "center",
  },
  {
    src: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1400&q=90",
    position: "center",
  },
  {
    src: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=1400&q=90",
    position: "center",
  },
];

function Label({ children, dark = false }) {
  return (
    <Text
      fontSize="10px"
      fontWeight="700"
      letterSpacing=".2em"
      textTransform="uppercase"
      color={dark ? "rgba(0,0,0,.42)" : "rgba(245,245,242,.42)"}
    >
      {children}
    </Text>
  );
}

function MainButton({ children, href = "#booking", light = false }) {
  return (
    <Box
      as="a"
      href={href}
      display="inline-flex"
      justifyContent="center"
      alignItems="center"
      minH="58px"
      px={{ base: 6, md: 8 }}
      bg={light ? "#efefeb" : "transparent"}
      color={light ? "#090909" : "#efefeb"}
      border="1px solid"
      borderColor={light ? "#efefeb" : "rgba(255,255,255,.35)"}
      textDecoration="none"
      textTransform="uppercase"
      fontSize="10px"
      fontWeight="800"
      letterSpacing=".18em"
      transition="all .2s ease"
      _hover={{
        bg: light ? "transparent" : "#efefeb",
        color: light ? "#efefeb" : "#090909",
      }}
    >
      {children}
    </Box>
  );
}

export default function Home() {
  return (
    <>
      <Head>
        <title>Prestízs Barber | Debrecen</title>
        <meta
          name="description"
          content="Prestízs Barber Debrecen – precíz hajvágás, szakálligazítás és karakteres megjelenés."
        />
      </Head>

      <Box
        bg="#090909"
        color="#efefeb"
        minH="100vh"
        overflowX="hidden"
        fontFamily="'Arial', 'Helvetica Neue', sans-serif"
      >
        <style>{`
          html {
            scroll-behavior: smooth;
          }

          body {
            margin: 0;
            background: #090909;
          }

          * {
            box-sizing: border-box;
          }

          ::selection {
            background: #efefeb;
            color: #090909;
          }

          @keyframes marquee {
            from {
              transform: translateX(0);
            }

            to {
              transform: translateX(-50%);
            }
          }

          @keyframes heroIn {
            from {
              opacity: 0;
              transform: translateY(30px);
            }

            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes imageIn {
            from {
              opacity: 0;
              transform: scale(1.08);
            }

            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>

        {/* NAV */}
        <Box
          as="nav"
          position="absolute"
          top="0"
          left="0"
          right="0"
          zIndex="20"
          borderBottom="1px solid rgba(255,255,255,.14)"
        >
          <Container maxW="1500px" px={{ base: 5, md: 8 }}>
            <Flex
              h={{ base: "74px", md: "86px" }}
              align="center"
              justify="space-between"
            >
              <Flex align="center" gap="13px">
                <Box
                  w="10px"
                  h="10px"
                  border="1px solid rgba(255,255,255,.8)"
                  transform="rotate(45deg)"
                />

                <Text
                  fontSize={{ base: "16px", md: "18px" }}
                  fontWeight="900"
                  letterSpacing="-.04em"
                >
                  PRESTÍZS
                </Text>
              </Flex>

              <HStack
                display={{ base: "none", md: "flex" }}
                gap={{ md: 7, lg: 10 }}
              >
                {[
                  ["Szolgáltatások", "#services"],
                  ["Munkáink", "#work"],
                  ["Rólunk", "#about"],
                  ["Kapcsolat", "#contact"],
                ].map(([name, href]) => (
                  <Box
                    key={name}
                    as="a"
                    href={href}
                    textDecoration="none"
                    color="rgba(255,255,255,.6)"
                    fontSize="11px"
                    fontWeight="600"
                    transition=".15s"
                    _hover={{ color: "white" }}
                  >
                    {name}
                  </Box>
                ))}
              </HStack>

              <Box
                as="a"
                href="#booking"
                color="white"
                textDecoration="none"
                fontSize="10px"
                fontWeight="800"
                letterSpacing=".15em"
                textTransform="uppercase"
              >
                Időpont
              </Box>
            </Flex>
          </Container>
        </Box>

        {/* HERO */}
        <Box
          as="section"
          minH="100svh"
          position="relative"
          overflow="hidden"
          display="flex"
          alignItems="flex-end"
        >
          <Box
            position="absolute"
            inset="0"
            backgroundImage="url('https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=2400&q=95')"
            backgroundSize="cover"
            backgroundPosition={{ base: "66% center", md: "center 38%" }}
            animation="imageIn 1.2s ease both"
          />

          <Box
            position="absolute"
            inset="0"
            bg="linear-gradient(90deg, rgba(0,0,0,.92) 0%, rgba(0,0,0,.64) 42%, rgba(0,0,0,.18) 80%)"
          />

          <Box
            position="absolute"
            inset="0"
            bg="linear-gradient(0deg, #090909 0%, rgba(9,9,9,.7) 10%, transparent 45%)"
          />

          <Container
            maxW="1500px"
            px={{ base: 5, md: 8 }}
            position="relative"
            zIndex="3"
            pb={{ base: 24, md: 20 }}
            pt="150px"
          >
            <Grid
              templateColumns={{ base: "1fr", lg: "1fr 300px" }}
              alignItems="end"
              gap="40px"
            >
              <Box>
                <Label>Debrecen · Barber shop</Label>

                <Heading
                  as="h1"
                  mt={{ base: 6, md: 8 }}
                  fontSize={{
                    base: "clamp(72px, 23vw, 120px)",
                    md: "clamp(120px, 15.5vw, 230px)",
                  }}
                  lineHeight=".72"
                  letterSpacing="-.085em"
                  fontWeight="900"
                  textTransform="uppercase"
                  animation="heroIn .8s ease both"
                >
                  Pres
                  <br />

                  <Box
                    as="span"
                    color="transparent"
                    style={{
                      WebkitTextStroke: "1px rgba(255,255,255,.48)",
                    }}
                  >
                    tízs.
                  </Box>
                </Heading>
              </Box>

              <Box pb={{ lg: 1 }}>
                <Text
                  fontSize={{ base: "17px", md: "19px" }}
                  lineHeight="1.55"
                  fontWeight="500"
                  maxW="300px"
                >
                  Nem trendeket másolunk.
                  <br />
                  A hozzád illő formát keressük.
                </Text>

                <Text
                  mt="22px"
                  color="rgba(255,255,255,.48)"
                  fontSize="13px"
                  lineHeight="1.7"
                  maxW="290px"
                >
                  Precíz hajvágás és szakállformázás azoknak, akiknél a
                  részletek is számítanak.
                </Text>

                <Box mt="32px">
                  <MainButton light>Foglalj időpontot</MainButton>
                </Box>
              </Box>
            </Grid>
          </Container>
        </Box>

        {/* MARQUEE */}
        <Box
          borderTop="1px solid rgba(255,255,255,.12)"
          borderBottom="1px solid rgba(255,255,255,.12)"
          overflow="hidden"
          py="17px"
        >
          <Flex width="max-content" animation="marquee 30s linear infinite">
            {[0, 1].map((group) => (
              <HStack
                key={group}
                flexShrink="0"
                gap={{ base: 8, md: 14 }}
                pr={{ base: 8, md: 14 }}
              >
                {[
                  "CUT",
                  "BEARD",
                  "DETAIL",
                  "FORM",
                  "STYLE",
                  "PRESTIGE",
                ].map((item) => (
                  <HStack
                    key={`${group}-${item}`}
                    gap={{ base: 8, md: 14 }}
                  >
                    <Text
                      fontSize="10px"
                      letterSpacing=".24em"
                      fontWeight="700"
                    >
                      {item}
                    </Text>

                    <Box
                      w="5px"
                      h="5px"
                      bg="rgba(255,255,255,.25)"
                      transform="rotate(45deg)"
                    />
                  </HStack>
                ))}
              </HStack>
            ))}
          </Flex>
        </Box>

        {/* ABOUT */}
        <Box
          as="section"
          id="about"
          py={{ base: 24, md: 40 }}
          bg="#090909"
        >
          <Container maxW="1500px" px={{ base: 5, md: 8 }}>
            <Grid
              templateColumns={{
                base: "1fr",
                xl: "minmax(0, 1fr) 280px",
              }}
              gap={{ base: 8, xl: 16 }}
              alignItems="start"
            >
              <Heading
                fontSize={{
                  base: "clamp(42px, 11vw, 70px)",
                  md: "clamp(62px, 7.4vw, 112px)",
                }}
                lineHeight=".97"
                letterSpacing="-.055em"
                fontWeight="600"
                maxW="1000px"
              >
                A jó hajvágás nem
                <Box as="span" color="rgba(255,255,255,.28)">
                  {" "}
                  kér figyelmet.
                </Box>
                <br />
                Megkapja.
              </Heading>

              <Text
                color="rgba(255,255,255,.46)"
                fontSize="13px"
                lineHeight="1.8"
                pt={{ xl: 3 }}
                maxW="280px"
              >
                Forma. Arány. Textúra. A különbség legtöbbször nem egy
                látványos trükkben, hanem néhány milliméterben van.
              </Text>
            </Grid>

            <Grid
              mt={{ base: 16, md: 28 }}
              templateColumns={{
                base: "1fr",
                lg: "minmax(0, 1.4fr) minmax(300px, .6fr)",
              }}
              gap={{ base: 8, md: 12 }}
              alignItems="end"
            >
              <Box
                minH={{ base: "460px", md: "720px" }}
                backgroundImage="url('https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=1800&q=95')"
                backgroundSize="cover"
                backgroundPosition="center"
                filter="grayscale(100%)"
                position="relative"
                overflow="hidden"
              >
                <Box
                  position="absolute"
                  inset="0"
                  bg="linear-gradient(0deg, rgba(0,0,0,.28), transparent 55%)"
                />
              </Box>

              <Box
                pb={{ lg: 5 }}
                pl={{ lg: 6 }}
                borderLeft={{
                  base: "none",
                  lg: "1px solid rgba(255,255,255,.14)",
                }}
              >
                <Text
                  fontSize={{ base: "24px", md: "31px" }}
                  lineHeight="1.35"
                  letterSpacing="-.025em"
                >
                  Nem az a cél, hogy úgy nézz ki, mint aki most jött ki a
                  barberből.
                </Text>

                <Text
                  mt="25px"
                  color="rgba(255,255,255,.4)"
                  fontSize="14px"
                  lineHeight="1.8"
                >
                  Hanem hogy két hét múlva is működjön a hajad.
                </Text>
              </Box>
            </Grid>
          </Container>
        </Box>

        {/* SERVICES */}
        <Box
          as="section"
          id="services"
          py={{ base: 24, md: 34 }}
          bg="#e9e9e4"
          color="#0a0a0a"
          overflow="hidden"
        >
          <Container maxW="1500px" px={{ base: 5, md: 8 }}>
            <Heading
              fontSize={{
                base: "clamp(54px, 15vw, 90px)",
                md: "clamp(90px, 10vw, 150px)",
              }}
              lineHeight=".8"
              letterSpacing="-.075em"
              textTransform="uppercase"
            >
              Vágás.
              <br />

              <Box
                as="span"
                color="transparent"
                style={{
                  WebkitTextStroke: "1px rgba(0,0,0,.35)",
                }}
              >
                Forma.
              </Box>

              <br />
              Karakter.
            </Heading>

            <Box
              mt={{ base: 16, md: 28 }}
              borderTop="1px solid rgba(0,0,0,.3)"
            >
              {services.map((service) => (
                <Grid
                  key={service.name}
                  templateColumns={{
                    base: "1fr auto",
                    md: "1fr 360px 130px",
                  }}
                  gap={{ base: 3, md: 8 }}
                  alignItems="center"
                  py={{ base: 7, md: 9 }}
                  borderBottom="1px solid rgba(0,0,0,.25)"
                  transition="padding .25s ease, background .25s ease"
                  position="relative"
                  _hover={{
                    pl: { md: 4 },
                    pr: { md: 4 },
                    bg: "rgba(0,0,0,.035)",
                  }}
                >
                  <Heading
                    fontSize={{
                      base: "27px",
                      md: "clamp(35px, 4vw, 58px)",
                    }}
                    fontWeight="600"
                    letterSpacing="-.04em"
                  >
                    {service.name}
                  </Heading>

                  <Text
                    display={{ base: "none", md: "block" }}
                    color="rgba(0,0,0,.48)"
                    fontSize="13px"
                  >
                    {service.description}
                  </Text>

                  <Text
                    textAlign="right"
                    fontSize={{ base: "13px", md: "15px" }}
                    fontWeight="700"
                    whiteSpace="nowrap"
                  >
                    {service.price} Ft
                  </Text>

                  <Text
                    gridColumn="1 / 3"
                    display={{ base: "block", md: "none" }}
                    color="rgba(0,0,0,.46)"
                    fontSize="12px"
                    lineHeight="1.6"
                  >
                    {service.description}
                  </Text>
                </Grid>
              ))}
            </Box>
          </Container>
        </Box>

        {/* WORK */}
        <Box
          as="section"
          id="work"
          py={{ base: 24, md: 38 }}
          position="relative"
        >
          <Container maxW="1500px" px={{ base: 5, md: 8 }}>
            <Heading
              mb={{ base: 14, md: 22 }}
              fontSize={{
                base: "clamp(65px, 20vw, 110px)",
                md: "clamp(110px, 13vw, 195px)",
              }}
              lineHeight=".75"
              letterSpacing="-.08em"
              textTransform="uppercase"
            >
              Work
              <Box as="span" color="rgba(255,255,255,.18)">
                .
              </Box>
            </Heading>

            <Grid
              templateColumns={{
                base: "1fr 1fr",
                md: "1.15fr .7fr .55fr",
              }}
              gap={{ base: 2, md: 4 }}
              alignItems="start"
            >
              <Box overflow="hidden">
                <Box
                  h={{ base: "390px", md: "760px" }}
                  backgroundImage={`url('${gallery[0].src}')`}
                  backgroundSize="cover"
                  backgroundPosition={gallery[0].position}
                  filter="grayscale(100%)"
                  transition="filter .6s ease, transform 1.2s cubic-bezier(.2,.7,.2,1)"
                  _hover={{
                    filter: "grayscale(0%)",
                    transform: "scale(1.018)",
                  }}
                />
              </Box>

              <Box
                mt={{ base: "90px", md: "180px" }}
                overflow="hidden"
              >
                <Box
                  h={{ base: "260px", md: "470px" }}
                  backgroundImage={`url('${gallery[1].src}')`}
                  backgroundSize="cover"
                  backgroundPosition={gallery[1].position}
                  filter="grayscale(100%)"
                  transition="filter .6s ease, transform 1.2s cubic-bezier(.2,.7,.2,1)"
                  _hover={{
                    filter: "grayscale(0%)",
                    transform: "scale(1.018)",
                  }}
                />
              </Box>

              <Box
                gridColumn={{ base: "1 / 3", md: "auto" }}
                width={{ base: "72%", md: "100%" }}
                ml={{ base: "auto", md: "0" }}
                mt={{ base: "40px", md: "40px" }}
                overflow="hidden"
              >
                <Box
                  h={{ base: "340px", md: "390px" }}
                  backgroundImage={`url('${gallery[2].src}')`}
                  backgroundSize="cover"
                  backgroundPosition={gallery[2].position}
                  filter="grayscale(100%)"
                  transition="filter .6s ease, transform 1.2s cubic-bezier(.2,.7,.2,1)"
                  _hover={{
                    filter: "grayscale(0%)",
                    transform: "scale(1.018)",
                  }}
                />
              </Box>
            </Grid>
          </Container>
        </Box>

        {/* STANDARD */}
        <Box
          py={{ base: 28, md: 48 }}
          borderTop="1px solid rgba(255,255,255,.12)"
          borderBottom="1px solid rgba(255,255,255,.12)"
        >
          <Container maxW="1500px" px={{ base: 5, md: 8 }}>
            <Heading
              maxW="1100px"
              fontSize={{
                base: "clamp(43px, 11vw, 72px)",
                md: "clamp(70px, 7vw, 110px)",
              }}
              fontWeight="500"
              lineHeight=".98"
              letterSpacing="-.055em"
            >
              „Elég jó”
              <Box
                as="span"
                display="block"
                color="rgba(255,255,255,.25)"
              >
                nincs a szolgáltatások között.
              </Box>
            </Heading>
          </Container>
        </Box>

        {/* BOOKING */}
        <Box
          id="booking"
          minH={{ base: "720px", md: "900px" }}
          position="relative"
          display="flex"
          alignItems="flex-end"
          overflow="hidden"
        >
          <Box
            position="absolute"
            inset="0"
            backgroundImage="url('https://images.unsplash.com/photo-1512690459411-b9245aed614b?auto=format&fit=crop&w=2400&q=95')"
            backgroundSize="cover"
            backgroundPosition="center"
            filter="grayscale(100%)"
          />

          <Box
            position="absolute"
            inset="0"
            bg="linear-gradient(90deg, rgba(0,0,0,.9), rgba(0,0,0,.25))"
          />

          <Box
            position="absolute"
            inset="0"
            bg="linear-gradient(0deg, rgba(0,0,0,.92), transparent 65%)"
          />

          <Container
            maxW="1500px"
            px={{ base: 5, md: 8 }}
            pb={{ base: 16, md: 20 }}
            position="relative"
            zIndex="2"
          >
            <Heading
              fontSize={{
                base: "clamp(62px, 18vw, 108px)",
                md: "clamp(110px, 12vw, 180px)",
              }}
              lineHeight=".78"
              letterSpacing="-.075em"
              textTransform="uppercase"
              maxW="1200px"
            >
              Következő
              <br />
              vágás

              <Box
                as="span"
                color="transparent"
                style={{
                  WebkitTextStroke: "1px rgba(255,255,255,.5)",
                }}
              >
                {" "}
                mikor?
              </Box>
            </Heading>

            <Flex
              mt={{ base: 10, md: 14 }}
              align={{ base: "flex-start", md: "center" }}
              direction={{ base: "column", md: "row" }}
              gap={{ base: 6, md: 9 }}
            >
              <MainButton light>Időpontot foglalok</MainButton>

              <Text
                color="rgba(255,255,255,.45)"
                fontSize="12px"
                lineHeight="1.7"
                maxW="260px"
              >
                Válassz szolgáltatást, barbert és időpontot.
              </Text>
            </Flex>
          </Container>
        </Box>

        {/* FOOTER */}
        <Box
          as="footer"
          id="contact"
          bg="#090909"
          pt={{ base: 20, md: 28 }}
        >
          <Container maxW="1500px" px={{ base: 5, md: 8 }}>
            <Grid
              templateColumns={{
                base: "1fr 1fr",
                md: "1.5fr .6fr .6fr .6fr",
              }}
              gap={{ base: 12, md: 10 }}
              pb={{ base: 20, md: 28 }}
            >
              <Box gridColumn={{ base: "1 / 3", md: "auto" }}>
                <Flex align="center" gap="13px">
                  <Box
                    w="10px"
                    h="10px"
                    border="1px solid white"
                    transform="rotate(45deg)"
                  />

                  <Heading fontSize="26px" letterSpacing="-.04em">
                    PRESTÍZS
                  </Heading>
                </Flex>

                <Text
                  mt="24px"
                  maxW="300px"
                  color="rgba(255,255,255,.4)"
                  fontSize="13px"
                  lineHeight="1.8"
                >
                  Precíz barber szolgáltatások.
                  <br />
                  Debrecen.
                </Text>
              </Box>

              <Box>
                <Label>Oldal</Label>

                <VStack align="stretch" mt="18px" gap="10px">
                  {[
                    "Szolgáltatások",
                    "Munkáink",
                    "Rólunk",
                    "Foglalás",
                  ].map((item) => (
                    <Text
                      key={item}
                      fontSize="12px"
                      color="rgba(255,255,255,.62)"
                    >
                      {item}
                    </Text>
                  ))}
                </VStack>
              </Box>

              <Box>
                <Label>Nyitva</Label>

                <Text
                  mt="18px"
                  color="rgba(255,255,255,.62)"
                  fontSize="12px"
                  lineHeight="1.9"
                >
                  H–P / 09–19
                  <br />
                  Szo / 09–15
                  <br />
                  V / Zárva
                </Text>
              </Box>

              <Box>
                <Label>Social</Label>

                <Text
                  mt="18px"
                  color="rgba(255,255,255,.62)"
                  fontSize="12px"
                  lineHeight="1.9"
                >
                  Instagram
                  <br />
                  Facebook
                  <br />
                  TikTok
                </Text>
              </Box>
            </Grid>

            <Flex
              borderTop="1px solid rgba(255,255,255,.1)"
              py="24px"
              justify="space-between"
              direction={{ base: "column", md: "row" }}
              gap="10px"
            >
              <Text
                fontSize="9px"
                color="rgba(255,255,255,.25)"
                letterSpacing=".12em"
                textTransform="uppercase"
              >
                © 2026 Prestízs Barber
              </Text>

              <Text
                fontSize="9px"
                color="rgba(255,255,255,.25)"
                letterSpacing=".12em"
                textTransform="uppercase"
              >
                Debrecen / Hungary
              </Text>
            </Flex>


          </Container>
        </Box>
      </Box>
    </>
  );
}